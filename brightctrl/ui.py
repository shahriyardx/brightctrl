import threading

import dearpygui.dearpygui as dpg

from .callbacks import (
    _load_brightness_thread,
    do_refresh,
    on_master_slider,
    on_slider_change,
    toggle_sync,
)
from .state import AppState
from .theme import ACCENT, GREEN, RED, TEXT_DIM, TEXT_MAIN, TEXT_MUT


def build_monitor_card(
    parent: str, mon: dict, state: AppState, initial_brightness: int = 50
) -> None:
    """Add a single monitor card (title + slider) to *parent*."""
    idx = mon["index"]
    name = mon.get("name", f"Monitor {idx}")
    bus = mon.get("bus", "")

    pct_tag = f"pct_{idx}"
    slider_tag = f"slider_{idx}"

    with dpg.group(parent=parent, indent=14):
        with dpg.group(horizontal=True):
            dpg.add_text(f"Display {idx}", color=list(ACCENT))
            dpg.add_spacer(width=6)
            dpg.add_text(name, color=list(TEXT_MAIN))
            if bus:
                dpg.add_spacer(width=6)
                dpg.add_text(f"[{bus}]", color=list(TEXT_MUT))

        dpg.add_spacer(height=4)

        with dpg.group(horizontal=True):
            dpg.add_slider_float(
                tag=slider_tag,
                default_value=float(initial_brightness),
                min_value=0.0,
                max_value=100.0,
                width=-72,
                format="",
                callback=on_slider_change(state),
                user_data=idx,
            )
            dpg.add_text(f"{initial_brightness}%", tag=pct_tag, color=list(ACCENT))

        dpg.add_spacer(height=8)
        dpg.add_separator()
        dpg.add_spacer(height=10)

    state.slider_tags[idx] = slider_tag
    state.value_tags[idx] = pct_tag


def build_ui(monitors: list, err: str, state: AppState) -> None:
    """
    Populate the monitors panel after detection.
    If no monitors were found, show troubleshooting hints instead.
    """
    state.monitors = monitors
    state.loading = True

    if not monitors:
        dpg.set_value("status_text", f"⚠  {err or 'No DDC/CI monitors detected.'}")
        with dpg.group(parent="monitors_panel"):
            dpg.add_spacer(height=8)
            dpg.add_text("Troubleshooting steps:", color=list(RED))
            dpg.add_spacer(height=4)
            for line in [
                "  sudo pacman -S ddcutil          # Arch",
                "  sudo apt install ddcutil         # Debian/Ubuntu",
                "  sudo dnf install ddcutil         # Fedora",
                "  sudo usermod -aG i2c $USER",
                "  sudo modprobe i2c-dev",
                "  echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf",
                "  (log out and back in for group change to take effect)",
            ]:
                dpg.add_text(line, color=list(TEXT_DIM))
        state.loading = False
        return

    dpg.set_value(
        "status_text", f"{len(monitors)} monitor(s) found — reading brightness…"
    )

    dpg.add_spacer(height=8, parent="monitors_panel")
    for mon in monitors:
        build_monitor_card("monitors_panel", mon, state, initial_brightness=50)

    state.loading = False
    state._brightness_ready = False
    threading.Thread(
        target=_load_brightness_thread, args=(state, monitors), daemon=True
    ).start()


def build_window(state: AppState) -> None:
    """Construct the main Dear PyGui window layout."""
    with dpg.window(
        tag="main_win",
        no_title_bar=True,
        no_move=True,
        no_resize=True,
        no_scrollbar=False,
    ):
        # Header
        with dpg.group(horizontal=True):
            dpg.add_text("BrightCtrl", color=list(ACCENT))
            dpg.add_spacer(width=8)
            dpg.add_text("DDC/CI brightness controller", color=list(TEXT_MUT))

        dpg.add_separator()
        dpg.add_spacer(height=4)

        # Toolbar
        with dpg.group(horizontal=True):
            dpg.add_checkbox(
                label=" Sync All Monitors",
                tag="sync_toggle",
                default_value=False,
                callback=toggle_sync(state),
            )
            dpg.add_spacer(width=16)
            dpg.add_button(
                label="Refresh",
                width=90,
                height=26,
                callback=do_refresh(state),
            )

        dpg.add_spacer(height=6)

        # Status line
        dpg.add_text("Detecting monitors…", tag="status_text", color=list(TEXT_DIM))
        dpg.add_spacer(height=8)

        # Sync panel (hidden until the checkbox is enabled)
        with dpg.child_window(tag="sync_panel", height=44, border=False, show=False):
            dpg.bind_item_theme("sync_panel", "sync_theme")
            with dpg.group(horizontal=True):
                dpg.add_slider_float(
                    tag="master_slider",
                    default_value=50.0,
                    min_value=0.0,
                    max_value=100.0,
                    width=-72,
                    format="",
                    callback=on_master_slider(state),
                )
                dpg.add_text("50%", tag="master_pct", color=list(GREEN))

        dpg.add_spacer(height=8)

        # Per-monitor cards
        with dpg.child_window(
            tag="monitors_panel", border=True, autosize_x=True, autosize_y=True
        ):
            dpg.add_spacer(height=8)
            dpg.add_text("Scanning displays…", color=list(TEXT_DIM))

        dpg.bind_item_theme("monitors_panel", "panel_theme")
