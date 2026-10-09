"""User preferences (persisted with QSettings) and the shared singleton."""
import json

from PySide6.QtCore import QObject, QSettings, Signal

DEFAULTS = {
    # appearance
    "theme": "Graphite", "ui_style": "Modern", "animations": True, "smooth_scroll": True, "custom_titlebar": False, "translucent": False, "accent": "", "highlight_color": "", "ui_size": 10, "ui_family": "",
    # document defaults
    "doc_family": "", "doc_size": 11.0, "line_spacing": 1.18, "para_after": 6,
    "text_width": 760, "margin_left": 0, "margin_right": 0, "styles_json": "{}",
    # general
    "backup_ms": 1500, "show_wordcount": True, "show_zoom": True, "zoom": 100, "reopen_last": False, "last_file": "",
    "recent": "[]", "custom_colors": "[]", "default_dir": "", "tabs_open": False, "confirm_reset": True,
    # editing
    "smart_quotes": False, "dashes": True, "md_shortcuts": True, "emoji_codes": True,
    "highlight_line": False, "paste_plain": False, "cursor_width": 2,
}


class Prefs(QObject):
    changed = Signal()

    def __init__(self):
        super().__init__()
        self._s = QSettings("TurboDocs", "TurboDocs")

    def get(self, key):
        default = DEFAULTS[key]
        v = self._s.value(key, default)
        try:
            if isinstance(default, bool):
                return v if isinstance(v, bool) else str(v).lower() == "true"
            if isinstance(default, int):
                return int(float(v))
            if isinstance(default, float):
                return float(v)
        except (TypeError, ValueError):
            return default
        return v

    def set(self, key, value, notify=True):
        self._s.setValue(key, value)
        if notify:
            self.changed.emit()

    def reset_all(self):
        for k in DEFAULTS:
            self._s.remove(k)
        self.changed.emit()

    # ---- small helpers for list-ish settings
    def recent(self):
        try:
            return [p for p in json.loads(self.get("recent")) if isinstance(p, str)]
        except ValueError:
            return []

    def add_recent(self, path):
        items = [p for p in self.recent() if p != path]
        self.set("recent", json.dumps(([path] + items)[:10]), notify=False)

    def customs(self):
        try:
            return [c for c in json.loads(self.get("custom_colors")) if isinstance(c, str)]
        except ValueError:
            return []

    def add_custom(self, color):
        items = [c for c in self.customs() if c != color]
        self.set("custom_colors", json.dumps(([color] + items)[:9]), notify=False)

    def clear_recent(self):
        self.set("recent", "[]", notify=False)


prefs = Prefs()
