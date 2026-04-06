"""
theme.py - Color palette and Dear PyGui theme setup for BrightCtrl.
"""

import os

import dearpygui.dearpygui as dpg

# ─── Palette ───────────────────────────────────────────────────────────────────

ACCENT = (96, 165, 250)
ACCENT_DIM = (37, 99, 235)
BG_DEEP = (10, 10, 22)
BG_CARD = (18, 18, 32)
BG_TRACK = (30, 30, 50)
TEXT_MAIN = (226, 232, 240)
TEXT_DIM = (100, 116, 139)
TEXT_MUT = (45, 55, 72)
RED = (248, 113, 113)
GREEN = (74, 222, 128)
GREEN_DIM = (34, 197, 94)
SYNC_BG = (10, 10, 22)

# ─── Font candidates (tried in order) ─────────────────────────────────────────

FONT_CANDIDATES = [
    "/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf",
    "/usr/share/fonts/jetbrains-mono/JetBrainsMono-Regular.ttf",
    "/usr/share/fonts/TTF/FiraMono-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
    "/usr/share/fonts/noto/NotoSansMono-Regular.ttf",
]


def apply_global_theme():
    """Create and bind the global Dear PyGui theme."""
    with dpg.theme() as global_theme:
        with dpg.theme_component(dpg.mvAll):
            dpg.add_theme_color(dpg.mvThemeCol_WindowBg, list(BG_DEEP))
            dpg.add_theme_color(dpg.mvThemeCol_ChildBg, list(BG_CARD))
            dpg.add_theme_color(dpg.mvThemeCol_FrameBg, list(BG_TRACK))
            dpg.add_theme_color(dpg.mvThemeCol_FrameBgHovered, (40, 40, 68))
            dpg.add_theme_color(dpg.mvThemeCol_FrameBgActive, (50, 50, 84))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrab, list(ACCENT))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrabActive, list(ACCENT_DIM))
            dpg.add_theme_color(dpg.mvThemeCol_CheckMark, list(ACCENT))
            dpg.add_theme_color(dpg.mvThemeCol_Button, list(BG_TRACK))
            dpg.add_theme_color(dpg.mvThemeCol_ButtonHovered, list(ACCENT_DIM))
            dpg.add_theme_color(dpg.mvThemeCol_ButtonActive, list(ACCENT))
            dpg.add_theme_color(dpg.mvThemeCol_Text, list(TEXT_MAIN))
            dpg.add_theme_color(dpg.mvThemeCol_Separator, (28, 28, 48))
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarBg, list(BG_DEEP))
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarGrab, list(BG_TRACK))
            dpg.add_theme_style(dpg.mvStyleVar_WindowRounding, 10)
            dpg.add_theme_style(dpg.mvStyleVar_FrameRounding, 6)
            dpg.add_theme_style(dpg.mvStyleVar_GrabRounding, 6)
            dpg.add_theme_style(dpg.mvStyleVar_GrabMinSize, 14)
            dpg.add_theme_style(dpg.mvStyleVar_ItemSpacing, 8, 10)
            dpg.add_theme_style(dpg.mvStyleVar_FramePadding, 8, 6)
            dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 16, 14)
            dpg.add_theme_style(dpg.mvStyleVar_ScrollbarSize, 10)
    dpg.bind_theme(global_theme)


def register_item_themes():
    """Create named themes that can be bound to individual items later."""
    with dpg.theme(tag="sync_theme"):
        with dpg.theme_component(dpg.mvAll):
            dpg.add_theme_color(dpg.mvThemeCol_ChildBg, list(SYNC_BG))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrab, list(GREEN))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrabActive, list(GREEN_DIM))

    with dpg.theme(tag="panel_theme"):
        with dpg.theme_component(dpg.mvAll):
            dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 14, 14)


def load_font(size=15):
    """Register and bind the first available monospace font."""
    with dpg.font_registry():
        for fp in FONT_CANDIDATES:
            if os.path.exists(fp):
                try:
                    dpg.bind_font(dpg.add_font(fp, size))
                    return
                except Exception:
                    continue
