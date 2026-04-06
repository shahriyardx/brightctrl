"""
BrightCtrl - Monitor brightness controller for Linux via DDC/CI.

Requirements
------------
System:
    ddcutil         (sudo pacman -S ddcutil  /  sudo apt install ddcutil  /  sudo dnf install ddcutil)
    i2c-dev module  (sudo modprobe i2c-dev)
    i2c group       (sudo usermod -aG i2c $USER  — then log out/in)
    Persist module: echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf

Python:
    pip install dearpygui   OR   uv add dearpygui

Usage
-----
    python -m main.py
"""

import threading

import dearpygui.dearpygui as dpg

from brightctrl.callbacks import _detect_thread
from brightctrl.state import AppState
from brightctrl.theme import apply_global_theme, load_font, register_item_themes
from brightctrl.ui import build_ui, build_window


def main() -> None:
    state = AppState()

    dpg.create_context()

    apply_global_theme()
    register_item_themes()
    load_font()

    build_window(state)

    dpg.create_viewport(
        title="BrightCtrl",
        width=540,
        height=580,
        min_width=440,
        min_height=280,
    )
    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.set_primary_window("main_win", True)

    threading.Thread(target=_detect_thread, args=(state,), daemon=True).start()

    # ── Render loop ────────────────────────────────────────────────────────────
    while dpg.is_dearpygui_running():
        if state._detect_ready:
            state._detect_ready = False
            monitors, err = state._detect_result
            dpg.delete_item("monitors_panel", children_only=True)
            build_ui(monitors, err, state)

        if state._brightness_ready:
            state._brightness_ready = False
            state.loading = True
            for mon in state.monitors:
                val = mon.get("_loaded_brightness")
                if val is not None and mon["index"] in state.slider_tags:
                    dpg.set_value(state.slider_tags[mon["index"]], float(val))
                    dpg.set_value(state.value_tags[mon["index"]], f"{val}%")
            dpg.set_value(
                "status_text",
                f"{len(state.monitors)} monitor(s) — DDC/CI via ddcutil",
            )
            state.loading = False

        dpg.render_dearpygui_frame()

    state.cancel_all()
    dpg.destroy_context()


if __name__ == "__main__":
    main()
