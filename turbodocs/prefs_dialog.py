"""Preferences: general, document defaults, paragraph styles, editing, appearance."""
import json
from dataclasses import fields

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QColor, QFont, QPainter, QPen
from PySide6.QtWidgets import (QCheckBox, QColorDialog, QComboBox, QDialog, QDialogButtonBox, QDoubleSpinBox,
                               QFileDialog, QFontComboBox, QFormLayout, QHBoxLayout, QLabel, QLineEdit, QListWidget,
                               QPushButton, QSpinBox, QStackedWidget, QTableWidget, QTableWidgetItem, QVBoxLayout,
                               QWidget)

from . import styles, theme
from .prefs import DEFAULTS, prefs


def _spin(lo, hi, val, suffix=""):
    s = QSpinBox()
    s.setRange(lo, hi)
    s.setValue(int(val))
    s.setSuffix(suffix)
    s.setMaximumWidth(150)
    s.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
    return s


def _dspin(lo, hi, val, step=0.05, dec=2):
    s = QDoubleSpinBox()
    s.setRange(lo, hi)
    s.setSingleStep(step)
    s.setDecimals(dec)
    s.setValue(float(val))
    s.setMaximumWidth(150)
    s.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
    return s


class ColorButton(QPushButton):
    """A button that is its own colour swatch. Painted directly so it is correct from the first frame
    and the whole rectangle is clickable."""

    def __init__(self, color="", fallback="#888888"):
        super().__init__()
        self._color, self._fallback = color, fallback
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumSize(150, 32)
        self.setSizePolicy(self.sizePolicy().horizontalPolicy().Fixed, self.sizePolicy().verticalPolicy().Fixed)

    def color(self):
        return self._color

    def setColor(self, color, fallback=None):
        self._color = color
        if fallback:
            self._fallback = fallback
        self.update()

    def paintEvent(self, e):
        col = QColor(self._color or self._fallback)
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        rect = self.rect().adjusted(1, 1, -1, -1)
        p.setBrush(col)
        hot = self.underMouse() or self.hasFocus()
        p.setPen(QPen(QColor(theme.cur["accent"]) if hot else QColor(128, 128, 128, 140), 2 if hot else 1))
        p.drawRoundedRect(rect, 6, 6)
        p.setPen(QColor("#111111") if col.lightnessF() > 0.55 else QColor("#ffffff"))
        label = self._color.upper() if self._color else f"THEME  {self._fallback.upper()}"
        p.drawText(rect, Qt.AlignmentFlag.AlignCenter, label)
        p.end()

    def enterEvent(self, e):
        self.update()
        super().enterEvent(e)

    def leaveEvent(self, e):
        self.update()
        super().leaveEvent(e)


class PrefsDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Preferences")
        self.resize(860, 540)
        self.accent = prefs.get("accent")
        root = QVBoxLayout(self)
        body = QHBoxLayout()
        self.nav = QListWidget()
        self.nav.setFixedWidth(160)
        self.nav.setObjectName("Sidebar")
        self.pages = QStackedWidget()
        body.addWidget(self.nav)
        body.addWidget(self.pages, 1)
        root.addLayout(body, 1)
        for name, builder in (("General", self._general), ("Document defaults", self._document),
                              ("Paragraph styles", self._styles), ("Editing", self._editing),
                              ("Appearance", self._appearance)):
            self.nav.addItem(name)
            w = QWidget()
            builder(w)
            self.pages.addWidget(w)
        self.nav.currentRowChanged.connect(self.pages.setCurrentIndex)
        self.nav.setCurrentRow(0)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
                              | QDialogButtonBox.StandardButton.Apply | QDialogButtonBox.StandardButton.RestoreDefaults)
        bb.accepted.connect(self._ok)
        bb.rejected.connect(self.reject)
        bb.button(QDialogButtonBox.StandardButton.Apply).clicked.connect(lambda: self.save())
        bb.button(QDialogButtonBox.StandardButton.RestoreDefaults).clicked.connect(self._restore)
        root.addWidget(bb)

    # ---- pages
    def _general(self, w):
        f = QFormLayout(w)
        self.backup_s = _spin(1, 120, prefs.get("backup_ms") / 1000, " s")
        self.show_wc = QCheckBox("Show word count in the status bar")
        self.show_wc.setChecked(prefs.get("show_wordcount"))
        self.show_zoom = QCheckBox("Show zoom control in the status bar")
        self.show_zoom.setChecked(prefs.get("show_zoom"))
        self.reopen = QCheckBox("Reopen the last document on startup")
        self.reopen.setChecked(prefs.get("reopen_last"))
        self.confirm_reset = QCheckBox("Ask before resetting session edits")
        self.confirm_reset.setChecked(prefs.get("confirm_reset"))
        self.def_dir = QLineEdit(prefs.get("default_dir"))
        self.def_dir.setPlaceholderText("Home folder")
        browse = QPushButton("Browse…")
        browse.clicked.connect(lambda: self.def_dir.setText(QFileDialog.getExistingDirectory(self, "Default folder") or self.def_dir.text()))
        row = QHBoxLayout()
        row.addWidget(self.def_dir, 1)
        row.addWidget(browse)
        f.addRow("Backup after idle for", self.backup_s)
        f.addRow("Default folder", row)
        f.addRow(self.show_wc)
        f.addRow(self.show_zoom)
        f.addRow(self.reopen)
        f.addRow(self.confirm_reset)

    def _document(self, w):
        f = QFormLayout(w)
        self.auto_font = QCheckBox("Automatic: use the colour theme's document font")
        self.auto_font.setChecked(not prefs.get("doc_family"))
        self.doc_family = QFontComboBox()
        if prefs.get("doc_family"):
            self.doc_family.setCurrentText(prefs.get("doc_family"))
        self.doc_family.setEnabled(not self.auto_font.isChecked())
        self.auto_font.toggled.connect(lambda on: self.doc_family.setEnabled(not on))
        self.doc_size = _dspin(6, 72, prefs.get("doc_size"), 0.5, 1)
        self.line = _dspin(1.0, 3.0, prefs.get("line_spacing"))
        self.after = _spin(0, 60, prefs.get("para_after"), " px")
        self.width_ = _spin(360, 1600, prefs.get("text_width"), " px")
        self.ml = _spin(0, 400, prefs.get("margin_left"), " px")
        self.mr = _spin(0, 400, prefs.get("margin_right"), " px")
        note = QLabel("Applies to new documents. Existing documents keep their own styles\n(Format ▸ Paragraph styles).")
        note.setObjectName("Muted")
        f.addRow("Default font", self.doc_family)
        f.addRow("", self.auto_font)
        f.addRow("Font size", self.doc_size)
        f.addRow("Line spacing", self.line)
        f.addRow("Space after paragraph", self.after)
        f.addRow("Text width", self.width_)
        f.addRow("Left margin", self.ml)
        f.addRow("Right margin", self.mr)
        f.addRow(note)

    def _styles(self, w):
        lay = QVBoxLayout(w)
        lay.addWidget(QLabel("Default look of each paragraph style for new documents."))
        defs = styles.user_defaults()
        self.style_keys = list(styles.STYLED)
        cols = ["Size (pt)", "Bold", "Italic", "Space before", "Space after", "Line spacing"]
        self.table = QTableWidget(len(self.style_keys), len(cols))
        self.table.setHorizontalHeaderLabels(cols)
        self.table.setVerticalHeaderLabels(self.style_keys)
        for r, k in enumerate(self.style_keys):
            d = defs[k]
            for c, (val, kind) in enumerate(((d.size, "n"), (d.bold, "b"), (d.italic, "b"), (d.before, "n"),
                                             (d.after, "n"), (d.line, "n"))):
                it = QTableWidgetItem()
                if kind == "b":
                    it.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled)
                    it.setCheckState(Qt.CheckState.Checked if val else Qt.CheckState.Unchecked)
                else:
                    it.setText(f"{val:g}")
                    if k == "Normal" and c == 0:
                        it.setText("document font")
                        it.setFlags(Qt.ItemFlag.NoItemFlags)
                self.table.setItem(r, c, it)
        from PySide6.QtWidgets import QHeaderView
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.table)
        reset = QPushButton("Reset styles to factory defaults")
        reset.clicked.connect(lambda: self.table.parent() and self._reset_styles())
        lay.addWidget(reset, 0, Qt.AlignmentFlag.AlignLeft)

    def _reset_styles(self):
        defs = styles.factory_defs()
        for r, k in enumerate(self.style_keys):
            d = defs[k]
            vals = [d.size, d.bold, d.italic, d.before, d.after, d.line]
            for c, v in enumerate(vals):
                it = self.table.item(r, c)
                if c in (1, 2):
                    it.setCheckState(Qt.CheckState.Checked if v else Qt.CheckState.Unchecked)
                elif not (k == "Normal" and c == 0):
                    it.setText(f"{v:g}")

    def _editing(self, w):
        f = QFormLayout(w)
        self.opts = {}
        for key, label in (("md_shortcuts", "Markdown shortcuts: “- ” bullets, “1. ” numbering, “# ” headings"),
                           ("dashes", "Turn -- into an em dash"),
                           ("smart_quotes", "Curly “smart” quotes"),
                           ("emoji_codes", "Emoji shortcodes: type :smile: or :fire:"),
                           ("highlight_line", "Highlight the current line"),
                           ("paste_plain", "Paste as plain text by default (Ctrl+Shift+V flips this)")):
            cb = QCheckBox(label)
            cb.setChecked(prefs.get(key))
            self.opts[key] = cb
            f.addRow(cb)
        self.cursor_w = _spin(1, 6, prefs.get("cursor_width"), " px")
        f.addRow("Caret width", self.cursor_w)
        self.hl_color = prefs.get("highlight_color")
        self.hl_btn = ColorButton(self.hl_color, prefs.get("accent") or theme.PRESETS[prefs.get("theme")]["accent"])
        self.hl_btn.clicked.connect(self._pick_highlight)
        hl_reset = QPushButton("Use accent colour")
        hl_reset.clicked.connect(lambda: (setattr(self, "hl_color", ""), self._paint_accent()))
        row = QHBoxLayout()
        row.addWidget(self.hl_btn)
        row.addWidget(hl_reset)
        row.addStretch(1)
        f.addRow("Default highlight", row)

    def _appearance(self, w):
        f = QFormLayout(w)
        self.theme = QComboBox()
        self.theme.addItems(list(theme.PRESETS))
        self.theme.setCurrentText(prefs.get("theme"))
        self.iface = QComboBox()
        self.iface.addItems(list(theme.IFACES))
        self.iface.setCurrentText(prefs.get("ui_style"))
        self.accent_btn = ColorButton(self.accent)
        self.accent_btn.clicked.connect(self._pick_accent)
        reset = QPushButton("Theme default")
        reset.clicked.connect(lambda: (setattr(self, "accent", ""), self._paint_accent()))
        self.preset = QComboBox()
        self.preset.addItem("Custom (choose below)")
        self.preset.addItems(list(theme.BUNDLES))
        self.preset.activated.connect(self._apply_bundle)
        row = QHBoxLayout()
        row.addWidget(self.accent_btn)
        row.addWidget(reset)
        row.addStretch(1)
        self.ui_size = _spin(8, 16, prefs.get("ui_size"), " pt")
        self.font_note = QLabel()
        self.font_note.setObjectName("Muted")
        self.theme.currentTextChanged.connect(self._update_font_note)
        self.ui_auto = QCheckBox("Automatic: use the theme's own font")
        self.ui_auto.setChecked(not prefs.get("ui_family"))
        self.ui_family = QFontComboBox()
        if prefs.get("ui_family"):
            self.ui_family.setCurrentText(prefs.get("ui_family"))
        self.ui_family.setEnabled(not self.ui_auto.isChecked())
        self.ui_auto.toggled.connect(lambda on: self.ui_family.setEnabled(not on))
        f.addRow("Quick preset", self.preset)
        f.addRow("Colour theme", self.theme)
        f.addRow("Interface style", self.iface)
        f.addRow("Accent colour", row)
        f.addRow("Interface font", self.ui_family)
        f.addRow("", self.ui_auto)
        f.addRow("", self.font_note)
        f.addRow("Interface size", self.ui_size)
        self.anim = QCheckBox("Animate buttons, menus and dialogs")
        self.anim.setChecked(prefs.get("animations"))
        self.smooth = QCheckBox("Smooth scrolling in documents")
        self.smooth.setChecked(prefs.get("smooth_scroll"))
        f.addRow("Motion", self.anim)
        f.addRow("", self.smooth)
        self.custom_tb = QCheckBox("Use TurboDocs window decorations (title bar and borders drawn in the theme)")
        self.custom_tb.setChecked(prefs.get("custom_titlebar"))
        f.addRow("Window", self.custom_tb)
        self.translucent = QCheckBox("Frosted glass menus and panels for the Liquid Glass style")
        self.translucent.setChecked(prefs.get("translucent"))
        f.addRow("", self.translucent)
        self._paint_accent()
        self._update_font_note()

    def _paint_accent(self):
        self.accent_btn.setColor(self.accent, theme.PRESETS[self.theme.currentText()]["accent"])
        if hasattr(self, "hl_btn"):
            self.hl_btn.setColor(self.hl_color, self.accent or theme.PRESETS[self.theme.currentText()]["accent"])

    def _update_font_note(self, *_):
        p = theme.PRESETS[self.theme.currentText()]
        have = theme.first_available(p["ui"], "")
        self.font_note.setText(f"This theme pairs with “{p['ui'][0]}”" + ("" if have == p["ui"][0] else
                               f" (not installed – using “{have or 'system default'}”)"))

    def _apply_bundle(self, i):
        if i == 0:
            return
        colour, iface = theme.BUNDLES[self.preset.currentText()]
        self.theme.setCurrentText(colour)
        self.iface.setCurrentText(iface)
        self.accent = ""
        self.ui_auto.setChecked(True)
        self._paint_accent()

    def _pick_accent(self):
        c = QColorDialog.getColor(QColor(self.accent or theme.cur["accent"]), self, "Accent colour")
        if c.isValid():
            self.accent = c.name()
            self._paint_accent()

    def _pick_highlight(self):
        c = QColorDialog.getColor(QColor(self.hl_color or self.accent or theme.cur["accent"]), self, "Default highlight colour")
        if c.isValid():
            self.hl_color = c.name()
            self._paint_accent()

    # ---- apply
    def _ok(self):
        """Close first, then apply: restyling the whole app takes a moment and shouldn't hold the dialog open."""
        self.save(emit=False)
        self.accept()
        QTimer.singleShot(30, prefs.changed.emit)

    def save(self, emit=True):
        s = prefs
        s.set("backup_ms", self.backup_s.value() * 1000, False)
        s.set("show_wordcount", self.show_wc.isChecked(), False)
        s.set("show_zoom", self.show_zoom.isChecked(), False)
        s.set("reopen_last", self.reopen.isChecked(), False)
        s.set("confirm_reset", self.confirm_reset.isChecked(), False)
        s.set("default_dir", self.def_dir.text().strip(), False)
        s.set("doc_family", "" if self.auto_font.isChecked() else self.doc_family.currentFont().family(), False)
        s.set("doc_size", self.doc_size.value(), False)
        s.set("line_spacing", self.line.value(), False)
        s.set("para_after", self.after.value(), False)
        s.set("text_width", self.width_.value(), False)
        s.set("margin_left", self.ml.value(), False)
        s.set("margin_right", self.mr.value(), False)
        for k, cb in self.opts.items():
            s.set(k, cb.isChecked(), False)
        s.set("cursor_width", self.cursor_w.value(), False)
        s.set("theme", self.theme.currentText(), False)
        s.set("ui_style", self.iface.currentText(), False)
        s.set("accent", self.accent, False)
        s.set("highlight_color", self.hl_color, False)
        s.set("ui_family", "" if self.ui_auto.isChecked() else self.ui_family.currentFont().family(), False)
        s.set("ui_size", self.ui_size.value(), False)
        s.set("animations", self.anim.isChecked(), False)
        s.set("smooth_scroll", self.smooth.isChecked(), False)
        s.set("custom_titlebar", self.custom_tb.isChecked(), False)
        s.set("translucent", self.translucent.isChecked(), False)
        s.set("styles_json", json.dumps(self._style_overrides()), False)
        if emit:
            s.changed.emit()

    def _style_overrides(self):
        factory, out = styles.factory_defs(), {}
        normal_line = self.line.value()
        for r, k in enumerate(self.style_keys):
            def num(c):
                try:
                    return float(self.table.item(r, c).text())
                except ValueError:
                    return None
            vals = dict(size=num(0) if k != "Normal" else 0.0,
                        bold=self.table.item(r, 1).checkState() == Qt.CheckState.Checked,
                        italic=self.table.item(r, 2).checkState() == Qt.CheckState.Checked,
                        before=num(3), after=num(4), line=num(5))
            diff = {}
            for fld in fields(styles.StyleDef):
                v, base = vals.get(fld.name), getattr(factory[k], fld.name)
                if v is None or fld.name not in vals:
                    continue
                if k == "Normal" and fld.name in ("line", "after"):
                    continue  # controlled by the Document defaults page
                if fld.name == "line" and abs(v - normal_line) < 1e-6:
                    continue
                if v != base:
                    diff[fld.name] = v
            if diff:
                out[k] = diff
        return out

    def _restore(self):
        prefs.reset_all()
        self.accept()
