//! DDC/CI backend. Linux drives `/dev/i2c-*` directly; Windows uses the Win32
//! Monitor Configuration API (dxva2) via `ddc-winapi`. Both read/write VCP
//! feature 0x10 (brightness) through the shared [`Backend`] trait.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

/// VCP feature code for luminance / brightness.
#[allow(dead_code)]
const VCP_BRIGHTNESS: u8 = 0x10;

/// Platform-agnostic handle to one monitor's brightness control. `Send` so a
/// detected `Monitor` can be moved off the background detect thread.
trait Backend: Send {
    fn set_brightness(&mut self, value: u16) -> Result<()>;
}

/// A detected monitor. The hardware handle is opened lazily (by `bus`) so a
/// monitor restored from the JSON cache — which has no handle — is still
/// controllable. On Linux `bus` is the `/dev/i2c-*` path; on Windows it is the
/// enumeration index used to re-open the handle.
#[derive(Serialize, Deserialize)]
pub struct Monitor {
    pub index: usize,
    pub name: String,
    pub bus: String,
    pub id: String,
    pub brightness: u16,
    #[serde(skip)]
    dev: Option<Box<dyn Backend>>,
}

impl Monitor {
    /// Borrow the hardware handle, opening it from `bus` on first use.
    fn dev(&mut self) -> Result<&mut Box<dyn Backend>> {
        if self.dev.is_none() {
            self.dev = Some(open(&self.bus)?);
        }
        Ok(self.dev.as_mut().unwrap())
    }

    /// Write a brightness value (0-100) to the monitor and update the field.
    pub fn set(&mut self, value: u16) -> Result<()> {
        let v = value.min(100);
        self.dev()?.set_brightness(v)?;
        self.brightness = v;
        Ok(())
    }

    /// Human-readable location shown under the monitor name. On Linux this is
    /// the i2c bus path; on Windows the handle has no address, so show a
    /// 1-based display number (which also disambiguates identical names).
    pub fn detail(&self) -> String {
        #[cfg(windows)]
        {
            format!("Display {}", self.index)
        }
        #[cfg(not(windows))]
        {
            self.bus.clone()
        }
    }

    /// Write the current `brightness` field to hardware without re-clamping.
    /// Used by the debounced TUI flush after the field was already updated.
    pub fn flush(&mut self) -> Result<()> {
        let v = self.brightness;
        self.dev()?.set_brightness(v)?;
        Ok(())
    }
}

// ═══════════════════════ Shared EDID parsing (all platforms) ═════════════════

/// Extract the monitor model name and a stable id from raw EDID bytes.
fn parse_edid(edid: &[u8]) -> (Option<String>, String) {
    let mfg = decode_mfg(edid[8], edid[9]);
    let product = u16::from_le_bytes([edid[10], edid[11]]);

    // Four 18-byte descriptor blocks. A monitor-name block starts with
    // 00 00 00 FC; the name is ASCII in bytes 5..18, '\n'-terminated.
    let mut name = None;
    for &off in &[54usize, 72, 90, 108] {
        let d = &edid[off..off + 18];
        if d[0] == 0 && d[1] == 0 && d[2] == 0 && d[3] == 0xFC {
            let s: String = d[5..18]
                .iter()
                .take_while(|&&c| c != 0x0A)
                .map(|&c| c as char)
                .collect();
            let s = s.trim().to_string();
            if !s.is_empty() {
                name = Some(s);
            }
        }
    }

    let id = format!("{mfg}{product:04X}");
    (name, id)
}

/// Decode the 3-letter manufacturer id packed into two EDID bytes (5 bits).
fn decode_mfg(b0: u8, b1: u8) -> String {
    let n = u16::from_be_bytes([b0, b1]);
    let c1 = ((n >> 10) & 0x1F) as u8;
    let c2 = ((n >> 5) & 0x1F) as u8;
    let c3 = (n & 0x1F) as u8;
    [c1, c2, c3]
        .iter()
        .map(|&c| (b'A' + c - 1) as char)
        .collect()
}

// ───────────────────────────── Linux backend ─────────────────────────────

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use ddc::{Ddc, Edid};
    use ddc_i2c::I2cDeviceDdc;

    struct LinuxBackend(I2cDeviceDdc);

    impl Backend for LinuxBackend {
        fn set_brightness(&mut self, value: u16) -> Result<()> {
            self.0
                .set_vcp_feature(VCP_BRIGHTNESS, value)
                .map_err(|e| anyhow!(e.to_string()))
        }
    }

    /// Re-open a monitor handle from its `/dev/i2c-*` bus path.
    pub fn open(bus: &str) -> Result<Box<dyn Backend>> {
        let dev = ddc_i2c::from_i2c_device(bus).map_err(|e| anyhow!(e.to_string()))?;
        Ok(Box::new(LinuxBackend(dev)))
    }

    /// Detect every controllable DDC/CI monitor, ordered by i2c bus number.
    pub fn detect() -> Result<Vec<Monitor>> {
        let mut buses: Vec<(u32, String)> = Vec::new();
        for entry in std::fs::read_dir("/dev")? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(num) = name.strip_prefix("i2c-") {
                if let Ok(n) = num.parse::<u32>() {
                    buses.push((n, format!("/dev/{name}")));
                }
            }
        }
        buses.sort_by_key(|(n, _)| *n);

        let mut monitors = Vec::new();
        let mut idx = 0usize;
        for (_, path) in buses {
            if let Some(mon) = probe(&path, idx + 1) {
                idx += 1;
                monitors.push(mon);
            }
        }
        Ok(monitors)
    }

    /// How many times to retry a flaky DDC/CI read before giving up on a bus.
    const PROBE_RETRIES: u32 = 5;
    const RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(40);

    /// Try to open one i2c bus and read it as a DDC/CI monitor. Returns `None`
    /// for buses with no monitor, no EDID, no DDC/CI brightness, or no
    /// permission. DDC/CI over i2c is unreliable — a single read often NAKs even
    /// on a healthy monitor — so reads are retried for a stable detected count.
    fn probe(path: &str, index: usize) -> Option<Monitor> {
        let mut dev = ddc_i2c::from_i2c_device(path).ok()?;

        let mut edid = [0u8; 128];
        let mut edid_ok = false;
        for attempt in 0..PROBE_RETRIES {
            if dev.read_edid(0, &mut edid).is_ok()
                && edid[0..8] == [0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00]
            {
                edid_ok = true;
                break;
            }
            if attempt + 1 < PROBE_RETRIES {
                std::thread::sleep(RETRY_DELAY);
            }
        }
        if !edid_ok {
            return None;
        }

        let mut brightness = None;
        for attempt in 0..PROBE_RETRIES {
            if let Ok(v) = dev.get_vcp_feature(VCP_BRIGHTNESS) {
                brightness = Some(v.value());
                break;
            }
            if attempt + 1 < PROBE_RETRIES {
                std::thread::sleep(RETRY_DELAY);
            }
        }
        let brightness = brightness?;

        let (name, id) = super::parse_edid(&edid);
        Some(Monitor {
            index,
            name: name.unwrap_or_else(|| "Unknown Monitor".to_string()),
            bus: path.to_string(),
            id,
            brightness,
            dev: Some(Box::new(LinuxBackend(dev))),
        })
    }
}

// ──────────────────────────── Windows backend ────────────────────────────

#[cfg(windows)]
mod platform {
    use super::*;
    use ddc::Ddc;
    use ddc_winapi::Monitor as WinMonitor;

    struct WinBackend(WinMonitor);

    // `WinMonitor` wraps a kernel HANDLE (raw pointer), so it isn't auto-`Send`.
    // Moving an owned monitor handle to the detect thread is safe.
    unsafe impl Send for WinBackend {}

    impl Backend for WinBackend {
        fn set_brightness(&mut self, value: u16) -> Result<()> {
            self.0
                .set_vcp_feature(VCP_BRIGHTNESS, value)
                .map_err(|e| anyhow!(e.to_string()))
        }
    }

    /// Re-open a monitor handle from its enumeration index (stored in `bus`).
    /// Windows handles aren't serializable, so we re-enumerate and pick by index.
    pub fn open(bus: &str) -> Result<Box<dyn Backend>> {
        let want: usize = bus.parse().map_err(|_| anyhow!("bad monitor index"))?;
        let mut mons = WinMonitor::enumerate().map_err(|e| anyhow!(e.to_string()))?;
        if want >= mons.len() {
            return Err(anyhow!("monitor {want} no longer present"));
        }
        Ok(Box::new(WinBackend(mons.swap_remove(want))))
    }

    /// Read raw EDID blobs from the Windows registry.
    /// Windows stores a copy of each monitor's EDID under
    /// `HKLM\SYSTEM\CurrentControlSet\Enum\DISPLAY\<hwid>\<instance>\Device Parameters\EDID`.
    fn read_edids_from_registry() -> Vec<(Option<String>, String)> {
        use winreg::enums::*;
        use winreg::RegKey;

        let hklm = match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
            r"SYSTEM\CurrentControlSet\Enum\DISPLAY",
            KEY_READ,
        ) {
            Ok(k) => k,
            Err(_) => return Vec::new(),
        };

        let mut edids = Vec::new();

        // Enumerate hardware-id subkeys (e.g. "DELA0EC", "GSM5B7F")
        for hw_id in hklm.enum_keys().filter_map(|k| k.ok()) {
            let hw_key = match hklm.open_subkey_with_flags(&hw_id, KEY_READ) {
                Ok(k) => k,
                Err(_) => continue,
            };
            // Each hardware id has one or more instance subkeys
            for instance in hw_key.enum_keys().filter_map(|k| k.ok()) {
                let dev_params = match hw_key.open_subkey_with_flags(
                    &format!("{instance}\\Device Parameters"),
                    KEY_READ,
                ) {
                    Ok(k) => k,
                    Err(_) => continue,
                };
                // EDID is a REG_BINARY value; valid EDID starts with the magic header
                if let Ok(raw) = dev_params.get_raw_value("EDID") {
                    let bytes = &raw.bytes;
                    if bytes.len() >= 128
                        && bytes[0..8] == [0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00]
                    {
                        let (name, id) = super::parse_edid(bytes);
                        edids.push((name, id));
                    }
                }
            }
        }

        edids
    }

    /// Detect every monitor the Windows Monitor Configuration API exposes.
    pub fn detect() -> Result<Vec<Monitor>> {
        let mons = WinMonitor::enumerate().map_err(|e| anyhow!(e.to_string()))?;
        let edid_entries = read_edids_from_registry();
        let mut monitors = Vec::new();
        for (i, mut m) in mons.into_iter().enumerate() {
            // Only keep monitors that answer a brightness read.
            let brightness = match m.get_vcp_feature(VCP_BRIGHTNESS) {
                Ok(v) => v.value(),
                Err(_) => continue,
            };

            // Prefer the EDID model name from the registry (like Twinkle Tray does).
            // Fall back to the Windows description if EDID isn't available for this
            // index, then to a generic placeholder.
            let (name, id) = match edid_entries.get(i) {
                Some((Some(ref edid_name), ref edid_id)) => (edid_name.clone(), edid_id.clone()),
                _ => {
                    let desc = m.description();
                    let name = if desc.trim().is_empty() {
                        format!("Monitor {}", i + 1)
                    } else {
                        desc
                    };
                    let id = format!("WIN{i}");
                    (name, id)
                }
            };

            monitors.push(Monitor {
                index: i + 1,
                name,
                bus: i.to_string(),
                id,
                brightness,
                dev: Some(Box::new(WinBackend(m))),
            });
        }
        Ok(monitors)
    }
}

/// Re-open a monitor handle from its stored `bus` identifier.
fn open(bus: &str) -> Result<Box<dyn Backend>> {
    platform::open(bus)
}

/// Detect every controllable DDC/CI monitor on this platform.
pub fn detect() -> Result<Vec<Monitor>> {
    let monitors = platform::detect()?;
    // Cache the result for instant startup next time. Don't overwrite a good
    // cache with an empty list (e.g. a transient bus glitch).
    if !monitors.is_empty() {
        crate::config::write_monitor_cache(&monitors);
    }
    Ok(monitors)
}
