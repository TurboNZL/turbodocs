"""Landing page: start a document or pick up where you left off."""
import re
import time
import zipfile
from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFontMetrics, QIcon
from PySide6.QtWidgets import (QFrame, QGridLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea, QVBoxLayout,
                               QWidget)

ICON = Path(__file__).parent / "resources" / "turbodocs.svg"
_snippets: dict = {}


def snippet(path: str) -> str:
    """First words of a .docx, read straight from its XML (fast, no full parse)."""
    try:
        mtime = Path(path).stat().st_mtime
        key = (path, mtime)
        if key not in _snippets:
            text = ""
            if path.lower().endswith(".docx"):
                with zipfile.ZipFile(path) as z:
                    xml = z.read("word/document.xml").decode("utf8", "replace")
                text = " ".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", xml[:200000]))
            else:
                text = Path(path).read_text(encoding="utf-8", errors="replace")[:600]
            text = re.sub(r"\s+", " ", text).strip()
            _snippets[key] = text[:150] + ("…" if len(text) > 150 else "")
        return _snippets[key]
    except Exception:
        return ""


def ago(ts: float) -> str:
    d = time.time() - ts
    if d < 60:
        return "just now"
    if d < 3600:
        return f"{int(d // 60)} min ago"
    if d < 86400:
        return f"{int(d // 3600)} h ago"
    if d < 172800:
        return "yesterday"
    if d < 86400 * 14:
        return f"{int(d // 86400)} days ago"
    return time.strftime("%d %b %Y", time.localtime(ts))


class Card(QFrame):
    clicked = Signal()

    def __init__(self, path: str):
        super().__init__()
        self.setObjectName("Card")
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(104)
        st = Path(path).stat()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(16, 12, 16, 12)
        lay.setSpacing(3)
        top = QHBoxLayout()
        name = QLabel(Path(path).stem)
        name.setObjectName("Name")
        when = QLabel(ago(st.st_mtime))
        when.setObjectName("Path")
        top.addWidget(name, 1)
        top.addWidget(when)
        lay.addLayout(top)
        loc = QLabel(QFontMetrics(self.font()).elidedText(str(Path(path).parent), Qt.TextElideMode.ElideMiddle, 340))
        loc.setObjectName("Path")
        lay.addWidget(loc)
        snip = QLabel(snippet(path) or "Empty document")
        snip.setObjectName("Snippet")
        snip.setWordWrap(True)
        lay.addWidget(snip, 1)
        self.setToolTip(path)

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and self.rect().contains(e.position().toPoint()):
            self.clicked.emit()
        super().mouseReleaseEvent(e)


class Dashboard(QWidget):
    newRequested = Signal()
    openRequested = Signal()
    openPath = Signal(str)
    clearRequested = Signal()
    newMdRequested = Signal()

    def __init__(self):
        super().__init__()
        self.setObjectName("Dash")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: transparent; } QScrollArea > QWidget > QWidget { background: transparent; }")
        outer.addWidget(scroll)
        host = QWidget()
        scroll.setWidget(host)
        row = QHBoxLayout(host)
        row.setContentsMargins(24, 48, 24, 40)
        row.addStretch(1)
        col = QWidget()
        col.setMaximumWidth(860)
        col.setMinimumWidth(320)
        self.col = QVBoxLayout(col)
        self.col.setSpacing(14)
        row.addWidget(col, 100)
        row.addStretch(1)

        head = QHBoxLayout()
        icon = QLabel()
        icon.setPixmap(QIcon(str(ICON)).pixmap(64, 64))
        titles = QVBoxLayout()
        t = QLabel("TurboDocs")
        t.setObjectName("Title")
        sub = QLabel("Pageless writing with full .docx compatibility")
        sub.setObjectName("Sub")
        titles.addWidget(t)
        titles.addWidget(sub)
        head.addWidget(icon)
        head.addSpacing(10)
        head.addLayout(titles, 1)
        self.col.addLayout(head)
        self.col.addSpacing(10)

        acts = QHBoxLayout()
        new = QPushButton("＋  New document")
        new.setDefault(True)
        new.setMinimumHeight(40)
        new.setCursor(Qt.CursorShape.PointingHandCursor)
        new.clicked.connect(self.newRequested)
        opn = QPushButton("Open file…")
        opn.setMinimumHeight(40)
        opn.setCursor(Qt.CursorShape.PointingHandCursor)
        opn.clicked.connect(self.openRequested)
        newmd = QPushButton("＋  New Markdown")
        newmd.setMinimumHeight(40)
        newmd.setCursor(Qt.CursorShape.PointingHandCursor)
        newmd.clicked.connect(self.newMdRequested)
        acts.addWidget(new)
        acts.addWidget(newmd)
        acts.addWidget(opn)
        acts.addStretch(1)
        self.col.addLayout(acts)
        self.col.addSpacing(8)

        sec = QHBoxLayout()
        lbl = QLabel("RECENT DOCUMENTS")
        lbl.setObjectName("Section")
        self.clear_btn = QPushButton("Clear list")
        self.clear_btn.setFlat(True)
        self.clear_btn.clicked.connect(self.clearRequested)
        sec.addWidget(lbl, 1)
        sec.addWidget(self.clear_btn)
        self.col.addLayout(sec)
        self.grid_host = QWidget()
        self.grid = QGridLayout(self.grid_host)
        self.grid.setContentsMargins(0, 0, 0, 0)
        self.grid.setSpacing(12)
        self.col.addWidget(self.grid_host)
        self.empty = QLabel("Documents you open or save will appear here.")
        self.empty.setObjectName("Sub")
        self.col.addWidget(self.empty)
        self.col.addStretch(1)
        tip = QLabel("Tip: press Ctrl+O to open, Ctrl+Alt+H to come back to this page.")
        tip.setObjectName("Sub")
        self.col.addWidget(tip)

    def refresh(self, paths):
        while self.grid.count():
            w = self.grid.takeAt(0).widget()
            if w:
                w.deleteLater()
        existing = [p for p in paths if Path(p).exists()][:10]
        for i, p in enumerate(existing):
            card = Card(p)
            card.clicked.connect(lambda p=p: self.openPath.emit(p))
            self.grid.addWidget(card, i // 2, i % 2)
        self.grid.setColumnStretch(0, 1)
        self.grid.setColumnStretch(1, 1)
        self.empty.setVisible(not existing)
        self.clear_btn.setVisible(bool(existing))
