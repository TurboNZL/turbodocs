"""Small popover panels: text-column layout and emoji picker."""
from PySide6.QtCore import QPoint, Qt, QTimer, Signal
from PySide6.QtWidgets import (QGridLayout, QHBoxLayout, QLabel, QPushButton, QSlider, QToolButton, QVBoxLayout,
                               QWidget)

EMOJI = ("😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😭 😡 🙄 😴 🤯 🥳 😇 🤗 😬 🥲 "
         "👍 👎 👏 🙌 🙏 💪 👀 👋 🤝 ✌️ 👌 🤞 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 "
         "🔥 ⭐ ✨ 🎉 🎯 💡 📌 📎 ✅ ❌ ⚠️ ❓ ❗ 💯 🚀 🌈 ☀️ 🌙 ⚡ 🍀 "
         "🍕 ☕ 🍺 🎂 🐶 🐱 🌸 🌍 📅 📝 📚 💻 📷 🔒 🔑 🏆").split()


class _Popup(QWidget):
    def __init__(self, parent):
        super().__init__(parent, Qt.WindowType.Popup | Qt.WindowType.FramelessWindowHint)
        self.setObjectName("Popup")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)

    def show_below(self, anchor: QWidget):
        self.adjustSize()
        pos = anchor.mapToGlobal(QPoint(anchor.width() - self.width(), anchor.height() + 6))
        screen = anchor.screen().availableGeometry()
        pos.setX(max(screen.left() + 4, min(pos.x(), screen.right() - self.width() - 4)))
        pos.setY(min(pos.y(), screen.bottom() - self.height() - 4))
        self.move(pos)
        self.show()


class LayoutPopup(_Popup):
    changed = Signal(int, int, int)

    def __init__(self, parent, width, left, right):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(16, 14, 16, 14)
        lay.setSpacing(6)
        self.sliders = []
        for label, lo, hi, val in (("Text width", 360, 1600, width),
                                   ("Left margin", 0, 400, left),
                                   ("Right margin", 0, 400, right)):
            row = QLabel()
            s = QSlider(Qt.Orientation.Horizontal)
            s.setRange(lo, hi)
            s.setValue(val)
            s.setMinimumWidth(240)
            s.valueChanged.connect(lambda v, r=row, t=label: (r.setText(f"{t}  ·  {v}px"), self._emit()))
            row.setText(f"{label}  ·  {val}px")
            lay.addWidget(row)
            lay.addWidget(s)
            self.sliders.append(s)
        reset = QPushButton("Reset")
        reset.clicked.connect(lambda: [s.setValue(v) for s, v in zip(self.sliders, (760, 0, 0))])
        lay.addSpacing(4)
        lay.addWidget(reset)

    def _emit(self):
        self.changed.emit(*(s.value() for s in self.sliders))


class EmojiPopup(_Popup):
    picked = Signal(str)

    def __init__(self, parent):
        super().__init__(parent)
        grid = QGridLayout(self)
        grid.setContentsMargins(10, 10, 10, 10)
        grid.setSpacing(2)
        for i, e in enumerate(EMOJI):
            b = QToolButton()
            b.setObjectName("Emoji")
            b.setText(e)
            b.clicked.connect(lambda _=False, e=e: (self.picked.emit(e), self.close()))
            grid.addWidget(b, i // 10, i % 10)


# ---------------------------------------------------------------- Google Docs style colour picker
GRAYS = "000000 434343 666666 999999 b7b7b7 cccccc d9d9d9 efefef f3f3f3 ffffff"
VIVID = "980000 ff0000 ff9900 ffff00 00ff00 00ffff 4a86e8 0000ff 9900ff ff00ff"
SHADES = [
    "e6b8af f4cccc fce5cd fff2cc d9ead3 d0e0e3 c9daf8 cfe2f3 d9d2e9 ead1dc",
    "dd7e6b ea9999 f9cb9c ffe599 b6d7a8 a2c4c9 a4c2f4 9fc5e8 b4a7d6 d5a6bd",
    "cc4125 e06666 f6b26b ffd966 93c47d 76a5af 6d9eeb 6fa8dc 8e7cc3 c27ba0",
    "a61c00 cc0000 e69138 f1c232 6aa84f 45818e 3c78d8 3d85c6 674ea7 a64d79",
    "85200c 990000 b45f06 bf9000 38761d 134f5c 1155cc 0b5394 351c75 741b47",
    "5b0f00 660000 783f04 7f6000 274e13 0c343d 1c4587 073763 20124d 4c1130",
]
PALETTE = [r.split() for r in (GRAYS, VIVID, *SHADES)]


SWATCH = 26


class ColorPicker(QWidget):
    """Swatch grid with a reset button and custom colours. picked('') means reset. Always square."""
    picked = Signal(str)

    def __init__(self, reset_label, customs, parent=None):
        super().__init__(parent)
        margin, vgap = 12, 4
        lay = QVBoxLayout(self)
        lay.setContentsMargins(margin, margin, margin, margin)
        lay.setSpacing(8)
        reset = QPushButton(reset_label)
        reset.clicked.connect(lambda: self.picked.emit(""))
        lay.addWidget(reset)
        self.grid = QGridLayout()
        self.grid.setVerticalSpacing(vgap)
        for r, row in enumerate(PALETTE):
            for c, hexv in enumerate(row):
                self.grid.addWidget(self._swatch("#" + hexv), r + (1 if r > 1 else 0), c)
        self.grid.setRowMinimumHeight(2, 8)  # the gap Docs leaves under the two top rows
        lay.addLayout(self.grid)
        cap = QLabel("CUSTOM")
        cap.setObjectName("Muted")
        lay.addWidget(cap)
        self.custom_row = QGridLayout()
        self.custom_row.setVerticalSpacing(vgap)
        plus = QToolButton()
        plus.setText("+")
        plus.setToolTip("Choose a custom colour…")
        plus.clicked.connect(self._custom)
        plus.setStyleSheet(f"QToolButton {{ min-width: {SWATCH}px; max-width: {SWATCH}px; min-height: {SWATCH}px; "
                           f"max-height: {SWATCH}px; padding: 0; border: 1px dashed rgba(128,128,128,0.7); "
                           f"border-radius: {SWATCH // 2}px; }}")
        self.custom_row.addWidget(plus, 0, 0)
        for i, col in enumerate(customs[:9], 1):
            self.custom_row.addWidget(self._swatch(col), 0, i)
        lay.addLayout(self.custom_row)
        # Make the whole panel a square: height is fixed by the rows, so spread the columns to match it.
        self.adjustSize()
        side = lay.sizeHint().height()
        hgap = max(4, (side - 2 * margin - 10 * SWATCH) // 9)
        self.grid.setHorizontalSpacing(hgap)
        self.custom_row.setHorizontalSpacing(hgap)
        self.custom_row.setColumnStretch(10, 1)
        self.setFixedSize(side, side)

    def _swatch(self, color):
        b = QToolButton()
        b.setToolTip(color.upper())
        # sizes live in the stylesheet: a stylesheet min-width would otherwise override setFixedSize
        b.setStyleSheet(f"QToolButton {{ background: {color}; border: 1px solid rgba(128,128,128,0.45); "
                        f"border-radius: {SWATCH // 2}px; padding: 0; min-width: {SWATCH}px; max-width: {SWATCH}px; "
                        f"min-height: {SWATCH}px; max-height: {SWATCH}px; }}"
                        f"QToolButton:hover {{ border: 2px solid #5b9cf6; }}")
        b.clicked.connect(lambda _=False, c=color: self.picked.emit(c))
        return b

    def _custom(self):
        # the dialog would close the popup, so the popup defers it until it has gone
        self.picked.emit("custom")


class ColorPopup(_Popup):
    """Floating colour picker. `chosen(color)` gives '#rrggbb', or '' for the reset entry."""
    chosen = Signal(str)

    def __init__(self, parent, reset_label):
        super().__init__(parent)
        from .prefs import prefs
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        picker = ColorPicker(reset_label, prefs.customs())
        picker.picked.connect(self._on_pick)
        lay.addWidget(picker)

    def _on_pick(self, color):
        self.close()
        if color == "custom":
            QTimer.singleShot(0, self._ask)  # the colour dialog must outlive this popup
        else:
            self.chosen.emit(color)

    def _ask(self):
        from PySide6.QtGui import QColor
        from PySide6.QtWidgets import QColorDialog
        from .prefs import prefs
        c = QColorDialog.getColor(QColor("#ffffff"), self.parentWidget(), "Custom colour")
        if c.isValid():
            prefs.add_custom(c.name())
            self.chosen.emit(c.name())


class SplitColorButton(QWidget):
    """Docs-style colour control: the icon applies the last colour, the arrow opens the picker."""
    apply = Signal()
    openPicker = Signal()

    def __init__(self, tip):
        super().__init__()
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        self.main = QToolButton()
        self.main.setToolTip(tip)
        self.main.setStyleSheet("QToolButton { border-top-right-radius: 0; border-bottom-right-radius: 0; padding-right: 4px; }")
        self.arrow = QToolButton()
        self.arrow.setText("▾")
        self.arrow.setToolTip(f"{tip} — more colours")
        self.arrow.setStyleSheet("QToolButton { border-top-left-radius: 0; border-bottom-left-radius: 0; "
                                 "padding: 5px 2px; min-width: 10px; }")
        self.main.clicked.connect(self.apply)
        self.arrow.clicked.connect(self.openPicker)
        lay.addWidget(self.main)
        lay.addWidget(self.arrow)

    def setIcon(self, icon):
        self.main.setIcon(icon)
