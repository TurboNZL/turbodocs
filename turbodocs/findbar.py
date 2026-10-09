"""Floating find / replace box (Ctrl+F, Ctrl+H)."""
import re

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QToolButton


class FindBar(QFrame):
    def __init__(self, parent, get_editor):
        super().__init__(parent)
        self.setObjectName("FindBar")
        self.get_editor = get_editor
        self.matches, self.current = [], -1
        self.find = QLineEdit(placeholderText="Find")
        self.repl = QLineEdit(placeholderText="Replace with")
        self.count = QLabel("")
        self.count.setObjectName("Muted")
        self.count.setMinimumWidth(64)
        self.case = self._toggle("Aa", "Match case")
        self.regex = self._toggle(".*", "Regular expression")
        prev, nxt, close = self._btn("▲", "Previous (Shift+Enter)"), self._btn("▼", "Next (Enter)"), self._btn("✕", "Close (Esc)")
        self.b_rep, self.b_all = QPushButton("Replace"), QPushButton("Replace all")
        grid = QGridLayout(self)
        grid.setContentsMargins(10, 8, 10, 8)
        grid.setHorizontalSpacing(4)
        top = QHBoxLayout()
        for w in (self.find, self.count, self.case, self.regex, prev, nxt, close):
            top.addWidget(w, 1 if w is self.find else 0)
        grid.addLayout(top, 0, 0)
        self.row2 = QHBoxLayout()
        for w in (self.repl, self.b_rep, self.b_all):
            self.row2.addWidget(w, 1 if w is self.repl else 0)
        grid.addLayout(self.row2, 1, 0)
        self.find.setMinimumWidth(190)
        self.find.textChanged.connect(self.refresh)
        self.find.returnPressed.connect(lambda: self.step(1))
        self.repl.returnPressed.connect(self.replace_one)
        self.case.toggled.connect(self.refresh)
        self.regex.toggled.connect(self.refresh)
        prev.clicked.connect(lambda: self.step(-1))
        nxt.clicked.connect(lambda: self.step(1))
        close.clicked.connect(self.close_bar)
        self.b_rep.clicked.connect(self.replace_one)
        self.b_all.clicked.connect(self.replace_all)
        self.hide()

    def _btn(self, text, tip):
        b = QToolButton()
        b.setText(text)
        b.setToolTip(tip)
        return b

    def _toggle(self, text, tip):
        b = self._btn(text, tip)
        b.setCheckable(True)
        return b

    def _set_replace_visible(self, on):
        for i in range(self.row2.count()):
            self.row2.itemAt(i).widget().setVisible(on)

    def open(self, replace=False):
        ed = self.get_editor()
        sel = ed.textCursor().selectedText()
        if sel and " " not in sel:
            self.find.setText(sel)
        self._set_replace_visible(replace)
        self.show()
        self.adjustSize()
        self.raise_()
        (self.repl if replace and self.find.text() else self.find).setFocus()
        self.find.selectAll() if not replace else None
        self.refresh()
        self.parentWidget().resizeEvent(None) if False else None

    def keyPressEvent(self, e):
        if e.key() == Qt.Key.Key_Escape:
            self.close_bar()
        elif e.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter) and e.modifiers() & Qt.KeyboardModifier.ShiftModifier:
            self.step(-1)
        else:
            super().keyPressEvent(e)

    def close_bar(self):
        ed = self.get_editor()
        ed.set_find_highlights([])
        self.hide()
        ed.setFocus()

    def refresh(self, *_):
        if not self.isVisible():
            return
        ed = self.get_editor()
        self.matches = ed.find_matches(self.find.text(), self.case.isChecked(), self.regex.isChecked())
        pos = ed.textCursor().selectionStart()
        self.current = next((i for i, (a, _b) in enumerate(self.matches) if a >= pos), 0 if self.matches else -1)
        self._show()

    def _show(self):
        ed = self.get_editor()
        ed.set_find_highlights(self.matches, self.current)
        if self.matches:
            self.count.setText(f"{self.current + 1} of {len(self.matches)}")
        else:
            self.count.setText("No results" if self.find.text() else "")

    def step(self, d):
        if not self.matches:
            return
        self.current = (self.current + d) % len(self.matches)
        a, b = self.matches[self.current]
        ed = self.get_editor()
        ed.goto_range(a, b)
        self._show()
        self.find.setFocus()

    def replace_one(self):
        if not self.matches:
            return
        ed = self.get_editor()
        a, b = self.matches[max(self.current, 0)]
        text = self.repl.text()
        if self.regex.isChecked():
            c = ed.textCursor()
            c.setPosition(a)
            c.setPosition(b, c.MoveMode.KeepAnchor)
            try:
                text = re.sub(self.find.text(), text.replace("\\n", "\n"), c.selectedText(),
                              flags=0 if self.case.isChecked() else re.I)
            except re.error:
                pass
        ed.replace_range(a, b, text)
        keep = self.current
        self.refresh()
        if self.matches:
            self.current = min(keep, len(self.matches) - 1)
            self._show()

    def replace_all(self):
        if not self.matches:
            return
        ed = self.get_editor()
        n = len(self.matches)
        ed.replace_all(self.matches, self.repl.text(), self.find.text() if self.regex.isChecked() else None,
                       self.case.isChecked())
        self.refresh()
        self.count.setText(f"Replaced {n}")
