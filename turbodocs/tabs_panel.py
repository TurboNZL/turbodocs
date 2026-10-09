"""Expandable floating document-tabs panel with a heading outline (Google Docs style)."""
from PySide6.QtCore import QEasingCurve, QVariantAnimation, Qt, Signal
from PySide6.QtWidgets import (QAbstractItemView, QFrame, QHBoxLayout, QLabel,
                               QListWidget, QListWidgetItem, QMenu, QToolButton, QVBoxLayout, QWidget)
from PySide6.QtGui import QColor

W_OPEN, W_CLOSED = 252, 38


class TabsPanel(QFrame):
    tabSelected = Signal(int)
    addRequested = Signal()
    renamed = Signal(int, str)
    deleteRequested = Signal(int)
    duplicateRequested = Signal(int)
    reordered = Signal(list)
    outlineClicked = Signal(int)
    toggled = Signal(bool)

    def __init__(self, parent):
        super().__init__(parent)
        self.setObjectName("Floating")
        self.expanded = False
        self._avail_h = 600
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)  # paint the frame ourselves, no effects

        self.pill = QToolButton(self)
        self.pill.setText("☰")
        self.pill.setAutoRaise(True)
        self.pill.setToolTip("Show document tabs")
        self.pill.clicked.connect(lambda: self.set_expanded(True))

        self.body = QWidget(self)
        lay = QVBoxLayout(self.body)
        lay.setContentsMargins(8, 8, 8, 8)
        lay.setSpacing(4)
        head = QHBoxLayout()
        lbl = QLabel("DOCUMENT TABS")
        lbl.setObjectName("Head")
        add = QToolButton(text="+")
        add.setToolTip("Add tab")
        add.clicked.connect(self.addRequested)
        close = QToolButton(text="‹")
        close.setToolTip("Collapse")
        close.clicked.connect(lambda: self.set_expanded(False))
        head.addWidget(lbl, 1)
        head.addWidget(add)
        head.addWidget(close)
        lay.addLayout(head)

        self.tabs = QListWidget()
        self.tabs.setDragDropMode(QAbstractItemView.DragDropMode.InternalMove)
        self.tabs.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.tabs.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.tabs.setTextElideMode(Qt.TextElideMode.ElideRight)
        self.outline_policy = None
        self.tabs.currentRowChanged.connect(self._row_changed)
        self.tabs.itemChanged.connect(self._item_renamed)
        self.tabs.customContextMenuRequested.connect(self._menu)
        self.tabs.model().rowsMoved.connect(self._moved)
        lay.addWidget(self.tabs, 3)
        olbl = QLabel("OUTLINE")
        olbl.setObjectName("Head")
        lay.addWidget(olbl)
        self.outline = QListWidget()
        self.outline.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.outline.setTextElideMode(Qt.TextElideMode.ElideRight)
        self.outline.itemClicked.connect(lambda it: self.outlineClicked.emit(it.data(Qt.ItemDataRole.UserRole)))
        lay.addWidget(self.outline, 4)

        self._anim = QVariantAnimation(self, duration=140, easingCurve=QEasingCurve.Type.OutCubic)
        self._anim.valueChanged.connect(lambda v: self._resize(int(v)))
        self._anim.finished.connect(lambda: self._resize(W_OPEN if self.expanded else W_CLOSED))
        self._resize(W_CLOSED)
        self.body.hide()

    # ---- state
    def set_expanded(self, on, animate=True):
        if on == self.expanded:
            return
        self.expanded = on
        self.toggled.emit(on)
        self._anim.stop()
        self.body.setVisible(on)   # visibility never waits on the animation finishing
        self.pill.setVisible(not on)
        self._anim.setStartValue(self.width())
        self._anim.setEndValue(W_OPEN if on else W_CLOSED)
        if animate:
            self._anim.start()
        else:
            self._resize(W_OPEN if on else W_CLOSED)

    def fit_height(self, canvas_h):
        self._avail_h = canvas_h
        self._resize(self.width())

    def _resize(self, w):
        h = min(self._avail_h - 28, 560) if (self.expanded or w > W_CLOSED + 4) else W_CLOSED
        self.setFixedSize(w, max(h, W_CLOSED))
        self.pill.setGeometry(0, 0, W_CLOSED, W_CLOSED)
        self.body.setGeometry(0, 0, w, self.height())

    # ---- data
    def set_tabs(self, titles, current):
        self.tabs.blockSignals(True)
        self.tabs.clear()
        for i, t in enumerate(titles):
            it = QListWidgetItem(t)
            it.setData(Qt.ItemDataRole.UserRole, i)
            it.setFlags(it.flags() | Qt.ItemFlag.ItemIsEditable)
            self.tabs.addItem(it)
        self.tabs.setCurrentRow(current)
        self.tabs.blockSignals(False)

    def set_outline(self, entries):
        self.outline.clear()
        for level, text, pos in entries:
            it = QListWidgetItem(("    " * max(0, level - 1)) + (text or "(empty heading)"))
            it.setData(Qt.ItemDataRole.UserRole, pos)
            if level == 0:
                f = it.font()
                f.setBold(True)
                it.setFont(f)
            self.outline.addItem(it)

    def _row_changed(self, row):
        if row >= 0:
            self.tabSelected.emit(self.tabs.item(row).data(Qt.ItemDataRole.UserRole))

    def _item_renamed(self, item):
        text = item.text().strip()
        self.renamed.emit(item.data(Qt.ItemDataRole.UserRole), text or "Untitled tab")

    def _moved(self, *_):
        order = [self.tabs.item(i).data(Qt.ItemDataRole.UserRole) for i in range(self.tabs.count())]
        self.reordered.emit(order)

    def _menu(self, pos):
        it = self.tabs.itemAt(pos)
        if it is None:
            return
        i = it.data(Qt.ItemDataRole.UserRole)
        m = QMenu(self)
        m.addAction("Rename", lambda: self.tabs.editItem(it))
        m.addAction("Duplicate", lambda: self.duplicateRequested.emit(i))
        m.addSeparator()
        m.addAction("Delete tab", lambda: self.deleteRequested.emit(i))
        m.exec(self.tabs.viewport().mapToGlobal(pos))
