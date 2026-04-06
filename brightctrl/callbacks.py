import threading

import dearpygui.dearpygui as dpg

from .ddc import detect_monitors, get_brightness
from .state import AppState


def _detect_thread(state: AppState) -> None:
    monitors, err = detect_monitors()
    state._detect_result = (monitors, err)
    state._detect_ready = True


def _load_brightness_thread(state: AppState, monitors: list) -> None:
    for mon in monitors:
        val = get_brightness(mon["index"])
        if val is not None:
            mon["_loaded_brightness"] = val
    state._brightness_ready = True


# ─── Slider callbacks ──────────────────────────────────────────────────────────


def on_slider_change(state: AppState):
    def _callback(sender: str, value: float, user_data: int) -> None:
        if state.syncing or state.loading:
            return

        display_index = user_data
        if display_index in state.value_tags:
            dpg.set_value(state.value_tags[display_index], f"{int(round(value))}%")

        if state.sync_mode:
            state.syncing = True
            for idx, stag in state.slider_tags.items():
                if idx != display_index:
                    dpg.set_value(stag, value)
                    if idx in state.value_tags:
                        dpg.set_value(state.value_tags[idx], f"{int(round(value))}%")
            if dpg.does_item_exist("master_slider"):
                dpg.set_value("master_slider", value)
                dpg.set_value("master_pct", f"{int(round(value))}%")
            state.syncing = False
            for mon in state.monitors:
                state.schedule_set(mon["index"], value)
        else:
            state.schedule_set(display_index, value)

    return _callback


def on_master_slider(state: AppState):
    def _callback(sender: str, value: float, user_data: None) -> None:
        if state.syncing or state.loading:
            return
        state.syncing = True
        dpg.set_value("master_pct", f"{int(round(value))}%")
        for idx, stag in state.slider_tags.items():
            dpg.set_value(stag, value)
            if idx in state.value_tags:
                dpg.set_value(state.value_tags[idx], f"{int(round(value))}%")
        state.syncing = False
        for mon in state.monitors:
            state.schedule_set(mon["index"], value)

    return _callback


# ─── Toolbar callbacks ─────────────────────────────────────────────────────────


def toggle_sync(state: AppState):
    def _callback(sender: str, app_data: bool, user_data: None) -> None:
        state.sync_mode = app_data
        if state.sync_mode:
            vals = [dpg.get_value(s) for s in state.slider_tags.values()]
            avg = sum(vals) / len(vals) if vals else 50.0
            dpg.set_value("master_slider", avg)
            dpg.set_value("master_pct", f"{int(round(avg))}%")
            dpg.show_item("sync_panel")
            dpg.hide_item("monitors_panel")
        else:
            dpg.hide_item("sync_panel")
            dpg.show_item("monitors_panel")

    return _callback


def do_refresh(state: AppState):
    def _callback() -> None:
        state.cancel_all()
        dpg.delete_item("monitors_panel", children_only=True)
        state.slider_tags.clear()
        state.value_tags.clear()
        state.monitors.clear()
        dpg.set_value("status_text", "Scanning DDC/CI displays…")
        state._detect_ready = False
        state._brightness_ready = False
        threading.Thread(target=_detect_thread, args=(state,), daemon=True).start()

    return _callback
