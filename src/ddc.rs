//! Native DDC/CI backend over Linux i2c-dev. No external `ddcutil` dependency.
//!
//! Enumerates `/dev/i2c-*`, reads each monitor's EDID for a name + stable id,
//! and reads/writes VCP feature 0x10 (brightness).

use anyhow::{anyhow, Result};
use ddc::{Ddc, Edid};
use ddc_i2c::I2cDeviceDdc;
use serde::{Deserialize, Serialize};

/// VCP feature code for luminance / brightness.
const VCP_BRIGHTNESS: u8 = 0x10;

/// A detected monitor. The i2c handle is opened lazily (by `bus`) so a monitor
/// restored from the JSON cache — which has no handle — is still controllable.
#[derive(Serialize, Deserialize)]
pub struct Monitor {
    pub index: usize,
    pub name: String,
    pub bus: String,
    pub id: String,
    pub brightness: u16,
    #[serde(skip)]
    dev: Option<I2cDeviceDdc>,
}

impl Monitor {
    /// Borrow the i2c handle, opening it from `bus` on first use.
    fn dev(&mut self) -> Result<&mut I2cDeviceDdc> {
        if self.dev.is_none() {
            self.dev = Some(
                ddc_i2c::from_i2c_device(&self.bus).map_err(|e| anyhow!(e.to_string()))?,
            );
        }
        Ok(self.dev.as_mut().unwrap())
    }

    /// Write a brightness value (0-100) to the monitor and update the field.
    pub fn set(&mut self, value: u16) -> Result<()> {
        let v = value.min(100);
        self.dev()?
            .set_vcp_feature(VCP_BRIGHTNESS, v)
            .map_err(|e| anyhow!(e.to_string()))?;
        self.brightness = v;
        Ok(())
    }

    /// Write the current `brightness` field to hardware without re-clamping.
    /// Used by the debounced TUI flush after the field was already updated.
    pub fn flush(&mut self) -> Result<()> {
        let v = self.brightness;
        self.dev()?
            .set_vcp_feature(VCP_BRIGHTNESS, v)
            .map_err(|e| anyhow!(e.to_string()))?;
        Ok(())
    }
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
    // Cache the result for instant startup next time. Don't overwrite a good
    // cache with an empty list (e.g. a transient bus glitch).
    if !monitors.is_empty() {
        crate::config::write_monitor_cache(&monitors);
    }
    Ok(monitors)
}

/// How many times to retry a flaky DDC/CI read before giving up on a bus.
const PROBE_RETRIES: u32 = 5;
const RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(40);

/// Try to open one i2c bus and read it as a DDC/CI monitor. Returns `None` for
/// buses with no monitor, no EDID, no DDC/CI brightness, or no permission.
///
/// DDC/CI over i2c is unreliable — a single read often NAKs even on a healthy
/// monitor, which is why `ddcutil` retries internally. We do the same so the
/// detected count is stable run to run.
fn probe(path: &str, index: usize) -> Option<Monitor> {
    let mut dev = ddc_i2c::from_i2c_device(path).ok()?;

    // Read EDID (retried). A valid header means a real display is attached.
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

    // Only keep monitors that actually answer a brightness read (retried).
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

    let (name, id) = parse_edid(&edid);
    Some(Monitor {
        index,
        name: name.unwrap_or_else(|| "Unknown Monitor".to_string()),
        bus: path.to_string(),
        id,
        brightness,
        dev: Some(dev),
    })
}

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

/// Decode the 3-letter manufacturer id packed into two EDID bytes (5 bits each).
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
