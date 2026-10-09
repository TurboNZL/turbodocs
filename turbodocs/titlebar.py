"""Optional custom window decorations: a themed title bar (caption buttons, drag, double-click maximise) that
follows the interface style, plus the helpers the main window needs to resize a frameless window."""
from PySide6.QtCore import QPointF, QRectF, QSize, Qt, QVariantAnimation
from PySide6.QtGui import QColor, QFont, QIcon, QLinearGradient, QPainter, QPen, QPixmap
from PySide6.QtWidgets import QAbstractButton, QGridLayout, QHBoxLayout, QLabel, QSizePolicy, QWidget

from . import theme

MIN, MAX, CLOSE = "min", "max", "close"
TIPS = {MIN: "Minimise", MAX: "Maximise", CLOSE: "Close"}
RESIZE_MARGIN = 5


def spec_for(kind, c, light, acc, on_accent) -> dict:
    """Title-bar look for an interface style (derived from the colour theme)."""
    ink = "#000000" if light else "#ffffff"
    base = dict(layout="win", btn="flat", h=32, bg=c["chrome"], fg=c["text"], fg_dim=c["muted"], bold=False,
                frame=theme.mix(c["bg"], c["text"], .22), frame_fill=c["chrome"], edge=5, btn_w=46, btn_h=0,
                hover=theme.mix(c["chrome"], ink, .07 if light else .09), press=theme.mix(c["chrome"], ink, .04 if light else .05),
                close="#c42b1c", close_press="#b22a1b", close_fg="#ffffff", align="left", inline_menu=True,
                mono=False)
    if kind == "win11":
        base.update(h=32, hover=theme.mix(c["chrome"], ink, .037 if light else .0605),
                    press=theme.mix(c["chrome"], ink, .024 if light else .04), frame=theme.mix(c["chrome"], ink, .10))
    elif kind == "win10":
        base.update(h=30, hover="#e5e5e5" if light else "#333333", press="#cccccc" if light else "#4d4d4d",
                    close="#e81123", close_press="#f1707a", frame=acc)
    elif kind == "aero":
        base.update(bg=[(0, "#dce9f8"), (.5, "#c3d6ee"), (.51, "#b9cfe9"), (1, "#c9dbf1")] if light else
                    [(0, theme.mix(c["chrome"], "#ffffff", .12)), (1, c["chrome"])],
                    fg="#1e1e1e" if light else c["text"], h=30, btn_w=28, btn_h=19, btn="aero", inline_menu=False,
                    frame="#5c7ba6" if light else c["border"], frame_fill="#b4cce8" if light else c["chrome"],
                    close="#c9372c", close_press="#a82a20")
    elif kind == "xp":
        base.update(bg=[(0, "#0997ff"), (.08, "#0058ee"), (.4, "#0050d6"), (.9, "#0049c9"), (1, "#003dd7")],
                    fg="#ffffff", bold=True, h=30, btn_w=21, btn_h=21, btn="xp", inline_menu=False, frame="#0831d9",
                    frame_fill="#0831d9", edge=4, close="#e0663d", mono=False)
    elif kind == "classic":
        base.update(bg=[(0, "#000080"), (1, "#1084d0")], fg="#ffffff", bold=True, h=20, btn_w=16, btn_h=14,
                    btn="bevel", inline_menu=False, frame="#000000", frame_fill=c["chrome"], edge=3)
    elif kind in ("gnome", "yaru"):
        base.update(layout="round", h=46 if kind == "gnome" else 40, align="center", bold=kind == "gnome",
                    btn="round", btn_w=28, frame=theme.mix(c["bg"], c["text"], .18),
                    hover=theme.mix(c["chrome"], ink, .12 if light else .14),
                    press=theme.mix(c["chrome"], ink, .2 if light else .22),
                    close=acc if kind == "yaru" else theme.mix(c["chrome"], ink, .12 if light else .14),
                    close_press=acc, close_fg=on_accent if kind == "yaru" else c["text"])
    elif kind == "rounded":
        base.update(layout="mac", h=38, align="center", btn="mac", btn_w=14, inline_menu=False)
    elif kind == "breeze":
        base.update(h=30, btn_w=30, hover=theme.mix(c["chrome"], acc, .25), press=theme.mix(c["chrome"], acc, .4),
                    close="#da4453", close_press="#b8323f")
    elif kind == "term":
        base.update(h=26, fg=acc, fg_dim=c["muted"], btn_w=34, hover=acc, press=theme.mix(acc, c["bg"], .3),
                    close=acc, close_press=theme.mix(acc, c["bg"], .3), close_fg=c["bg"], frame=acc, mono=True)
    else:  # modern & friends
        base.update(h=34, btn_w=42, close="#d9453b", close_press="#b9362d", frame=theme.mix(c["bg"], c["text"], .20))
    return base


class CaptionButton(QAbstractButton):
    def __init__(self, role, parent=None):
        super().__init__(parent)
        self.role, self._hover, self._maximised = role, 0.0, False
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.setCursor(Qt.CursorShape.ArrowCursor)
        self.setToolTip(TIPS[role])
        self._anim = QVariantAnimation(self)
        self._anim.valueChanged.connect(self._set_hover)
        self.spec = {}

    def _set_hover(self, v):
        self._hover = float(v)
        self.update()

    def set_maximised(self, on):
        self._maximised = on
        if self.role == MAX:
            self.setToolTip("Restore" if on else "Maximise")
            self.update()

    def set_spec(self, spec):
        self.spec = spec
        bw, bh = spec["btn_w"], spec["btn_h"] or spec["h"]
        if spec["btn"] in ("mac", "round"):
            bw = bh = spec["btn_w"]
        self.setFixedSize(bw, bh)
        self.update()

    def _fade(self, target):
        ms = theme.fx.get("ms", 0)
        if not ms:
            self._set_hover(target)
            return
        self._anim.stop()
        self._anim.setStartValue(self._hover)
        self._anim.setEndValue(float(target))
        self._anim.setDuration(max(1, int(ms * abs(target - self._hover))))
        self._anim.start()

    def enterEvent(self, e):
        self._fade(1.0)

    def leaveEvent(self, e):
        self._fade(0.0)

    # ---- painting
    def paintEvent(self, e):
        s = self.spec
        if not s:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        down, hv = self.isDown(), self._hover
        kind, r = s["btn"], QRectF(self.rect())
        close = self.role == CLOSE
        fg = QColor(s["fg"])
        if kind == "flat":
            if hv > 0 or down:
                col = s["close_press" if down else "close"] if close else s["press" if down else "hover"]
                fill = QColor(col)
                fill.setAlphaF(1.0 if down else hv)
                p.fillRect(r, fill)
            if close and (hv > 0.5 or down):
                fg = QColor(s["close_fg"])
            elif not self.window().isActiveWindow():
                fg = QColor(s["fg_dim"])
            self._glyph(p, r, fg, thin=True)
        elif kind == "aero":
            rr = r.adjusted(1, 1, -1, -1)
            col = ("#e8a39c", "#c9372c") if close else ("#f5f9fd", "#b9d3ee")
            g = QLinearGradient(rr.topLeft(), rr.bottomLeft())
            g.setColorAt(0, QColor(col[0]))
            g.setColorAt(.5, QColor(col[1]).lighter(110))
            g.setColorAt(.51, QColor(col[1]))
            g.setColorAt(1, QColor(col[1]).lighter(120))
            p.setPen(QPen(QColor("#4a6a96"), 1))
            p.setBrush(g)
            p.setOpacity(.55 + .45 * (1.0 if down else hv))
            p.drawRoundedRect(rr, 3, 3)
            p.setOpacity(1)
            self._glyph(p, rr, QColor("#ffffff" if close else "#1e2a3a"), thin=False)
        elif kind == "xp":
            rr = r.adjusted(.5, .5, -.5, -.5)
            top, bot = ("#e8a590", "#c4381a") if close else ("#6ea0f5", "#2253d6")
            if hv or down:
                top, bot = QColor(top).lighter(112 if not down else 90).name(), QColor(bot).lighter(112 if not down else 90).name()
            g = QLinearGradient(rr.topLeft(), rr.bottomRight())
            g.setColorAt(0, QColor(top))
            g.setColorAt(1, QColor(bot))
            p.setPen(QPen(QColor("#ffffff"), 1.4))
            p.setBrush(g)
            p.drawRoundedRect(rr, 3.5, 3.5)
            self._glyph(p, rr, QColor("#ffffff"), thin=False)
        elif kind == "bevel":
            hi, sh = QColor("#ffffff"), QColor("#404040")
            p.setRenderHint(QPainter.RenderHint.Antialiasing, False)
            p.fillRect(r, QColor(theme.cur["chrome"]))
            tl, br = (sh, hi) if down else (hi, sh)
            p.setPen(tl)
            p.drawLine(0, 0, int(r.width()) - 2, 0)
            p.drawLine(0, 0, 0, int(r.height()) - 2)
            p.setPen(br)
            p.drawLine(0, int(r.height()) - 1, int(r.width()) - 1, int(r.height()) - 1)
            p.drawLine(int(r.width()) - 1, 0, int(r.width()) - 1, int(r.height()) - 1)
            p.translate(1 if down else 0, 1 if down else 0)
            self._glyph(p, r, QColor("#000000"), thin=False)
        elif kind == "round":
            d = min(r.width(), r.height()) - 4
            c = QRectF(r.center().x() - d / 2, r.center().y() - d / 2, d, d)
            base = QColor(s["hover"])
            base.setAlphaF(.55)
            col = QColor(s["close" if close else "hover"])
            if close and s["close"] != s["hover"]:
                fill = QColor(col)
            else:
                fill = QColor(s["press" if down else "hover"])
                fill.setAlphaF(.45 + .55 * hv if not down else 1.0)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(fill)
            p.drawEllipse(c)
            self._glyph(p, c, QColor(s["close_fg"] if close and s["close"] != s["hover"] else s["fg"]), thin=True)
        elif kind == "mac":
            col = QColor({CLOSE: "#ff5f57", MIN: "#febc2e", MAX: "#28c840"}[self.role])
            if not self.window().isActiveWindow():
                col = QColor(theme.mix(theme.cur["chrome"], theme.cur["text"], .25))
            if down:
                col = col.darker(115)
            p.setPen(QPen(col.darker(120), 0.8))
            p.setBrush(col)
            d = r.width() - 1
            p.drawEllipse(QRectF(.5, .5, d, d))
            if self.underMouse() or getattr(self.parent(), "mac_hover", False):
                self._glyph(p, QRectF(.5, .5, d, d).adjusted(2, 2, -2, -2), QColor(0, 0, 0, 150), thin=True, small=True)
        p.end()

    def _glyph(self, p, rect, fg, thin=True, small=False):
        c = rect.center()
        k = 5.0 if thin and not small else (3.2 if small else (4.0 if self.spec["btn"] != "bevel" else 3.5))
        if self.spec["btn"] in ("round",):
            k = 4.0
        pen = QPen(fg, 1.0 if thin and not small else (1.2 if small else 2.0))
        pen.setCapStyle(Qt.PenCapStyle.FlatCap if thin and self.spec["btn"] == "flat" else Qt.PenCapStyle.SquareCap)
        p.setPen(pen)
        p.setBrush(Qt.BrushStyle.NoBrush)
        x, y = c.x(), c.y()
        if self.spec["btn"] in ("flat", "round") and not small:
            x, y = round(x) + .5, round(y) + .5
        if self.role == MIN:
            yy = y + (k - 1 if self.spec["btn"] in ("xp", "aero", "bevel") else 0)
            p.drawLine(QPointF(x - k, yy), QPointF(x + k, yy))
        elif self.role == MAX:
            if self._maximised:
                o = 1.8 if k > 3.5 else 1.4
                p.drawRect(QRectF(x - k, y - k + o * 1.6, k * 2 - o * 1.6, k * 2 - o * 1.6))
                p.drawPolyline([QPointF(x - k + o * 1.6, y - k + o * 1.6), QPointF(x - k + o * 1.6, y - k),
                                QPointF(x + k, y - k), QPointF(x + k, y + k - o * 1.6), QPointF(x + k - o * 1.6, y + k - o * 1.6)])
            else:
                p.drawRect(QRectF(x - k, y - k, k * 2, k * 2))
        else:
            p.drawLine(QPointF(x - k, y - k), QPointF(x + k, y + k))
            p.drawLine(QPointF(x - k, y + k), QPointF(x + k, y - k))


class MacGroup(QWidget):
    """Holds the three traffic lights so they all show their glyphs while the pointer is over the group."""
    mac_hover = False

    def enterEvent(self, e):
        self.mac_hover = True
        for b in self.findChildren(CaptionButton):
            b.update()

    def leaveEvent(self, e):
        self.mac_hover = False
        for b in self.findChildren(CaptionButton):
            b.update()


class TopBar(QWidget):
    """Title row (icon, title, caption buttons) with the menu bar either inline or on a second row."""

    def __init__(self, win, menubar):
        super().__init__(win)
        self.setObjectName("TopBar")
        self.win, self.menubar = win, menubar
        menubar.setParent(self)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.icon = QLabel()
        self.icon.setFixedSize(16, 16)
        self.icon.setScaledContents(True)
        self.title = QLabel()
        self.title.setObjectName("TitleText")
        self.title.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.buttons = {r: CaptionButton(r) for r in (MIN, MAX, CLOSE)}
        self.btn_box = MacGroup()
        self.btn_box.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.btn_lay = QHBoxLayout(self.btn_box)
        self.buttons[MIN].clicked.connect(win.showMinimized)
        self.buttons[MAX].clicked.connect(win.toggle_maximised)
        self.buttons[CLOSE].clicked.connect(win.close)
        self.grid = QGridLayout(self)
        self.grid.setContentsMargins(0, 0, 0, 0)
        self.grid.setSpacing(0)
        self.custom = False
        self.spec = {}
        menubar.setSizePolicy(QSizePolicy.Policy.Maximum, QSizePolicy.Policy.Preferred)
        self._layout()

    def set_icon(self, icon: QIcon):
        self.icon.setPixmap(icon.pixmap(32, 32))

    def configure(self, custom: bool, spec: dict):
        self.custom, self.spec = custom, spec
        for b in self.buttons.values():
            b.set_spec(spec)
        self._layout()
        self.title.setStyleSheet("")
        if custom:
            f = QFont(self.title.font())
            f.setBold(spec["bold"])
            if spec["mono"]:
                f.setStyleHint(QFont.StyleHint.Monospace)
            f.setPointSizeF(max(8.0, f.pointSizeF() * (0.95 if spec["layout"] == "win" else 1.0)))
            self.title.setFont(f)
            self.title.setStyleSheet(f"color: {spec['fg']}; background: transparent;")
        self.updateGeometry()

    def _clear(self):
        for w in (self.icon, self.title, self.menubar, self.btn_box):
            self.grid.removeWidget(w)
        while self.btn_lay.count():
            self.btn_lay.takeAt(0)
        for i in range(4):
            self.grid.setColumnStretch(i, 0)

    def _layout(self):
        self._clear()
        s, custom = self.spec, self.custom
        for w in (self.icon, self.title, self.btn_box):
            w.setVisible(custom)
        if not custom:
            self.menubar.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
            self.grid.addWidget(self.menubar, 0, 0)
            self.grid.setRowMinimumHeight(0, 0)
            self.setMinimumHeight(0)
            self.setMaximumHeight(16777215)
            return
        h = s["h"]
        lay = self.btn_lay
        lay.setContentsMargins(0, 0, 6 if s["layout"] != "win" else 0, 0)
        lay.setSpacing({"mac": 8, "round": 6}.get(s["layout"], 2 if s["btn"] in ("xp", "bevel", "aero") else 0))
        order = (CLOSE, MIN, MAX) if s["layout"] == "mac" else (MIN, MAX, CLOSE)
        for r in order:
            lay.addWidget(self.buttons[r])
            self.buttons[r].show()
        if s["layout"] == "mac":
            lay.setContentsMargins(12, 0, 0, 0)
        elif s["btn"] in ("xp", "bevel", "aero"):
            lay.setContentsMargins(0, 0, 4, 0)
        self.btn_box.setFixedHeight(h)
        title_row_h = h
        inline = s["inline_menu"] and s["layout"] == "win"
        self.menubar.setSizePolicy(QSizePolicy.Policy.Maximum if inline else QSizePolicy.Policy.Expanding,
                                   QSizePolicy.Policy.Preferred)
        self.setFixedHeight(h if inline else h + self.menubar.sizeHint().height())
        if s["layout"] == "mac":
            self.grid.addWidget(self.btn_box, 0, 0)
            self.grid.addWidget(self.title, 0, 1)
            self.grid.addWidget(self.menubar, 1, 0, 1, 3)
            self.grid.setColumnStretch(1, 1)
            self.title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.icon.hide()
            self.grid.setRowMinimumHeight(0, title_row_h)
            return
        self.grid.addWidget(self.icon, 0, 0)
        self.grid.setColumnMinimumWidth(0, 0)
        if inline:
            self.grid.addWidget(self.menubar, 0, 1)
            self.grid.addWidget(self.title, 0, 2)
            self.grid.addWidget(self.btn_box, 0, 3)
            self.grid.setColumnStretch(2, 1)
            self.grid.setColumnStretch(1, 0)
        else:
            self.grid.addWidget(self.title, 0, 1)
            self.grid.addWidget(self.btn_box, 0, 2)
            self.grid.addWidget(self.menubar, 1, 0, 1, 3)
            self.grid.setColumnStretch(1, 1)
            self.grid.setColumnStretch(2, 0)
        self.grid.setRowMinimumHeight(0, title_row_h)
        self.title.setAlignment((Qt.AlignmentFlag.AlignHCenter if (s["align"] == "center" or inline) else Qt.AlignmentFlag.AlignLeft)
                                | Qt.AlignmentFlag.AlignVCenter)
        self.icon.setContentsMargins(0, 0, 0, 0)
        self.grid.setColumnMinimumWidth(0, 28)
        self.icon.setAlignment(Qt.AlignmentFlag.AlignCenter)

    def set_title(self, text):
        self.title.setText(text)

    def set_maximised(self, on):
        self.buttons[MAX].set_maximised(on)

    # ---- drag / double-click
    def mousePressEvent(self, e):
        if self.custom and e.button() == Qt.MouseButton.LeftButton and not self.win.isMaximized() and \
                not self.win.isFullScreen():
            h = self.win.windowHandle()
            if h is not None:
                h.startSystemMove()
                return
        super().mousePressEvent(e)

    def mouseDoubleClickEvent(self, e):
        if self.custom and e.button() == Qt.MouseButton.LeftButton:
            self.win.toggle_maximised()
            return
        super().mouseDoubleClickEvent(e)


def edges_at(pos, size, m=RESIZE_MARGIN, corner=12):
    """Qt.Edges under a point of a frameless window (the outer band, with larger corner zones)."""
    x, y, w, h = pos.x(), pos.y(), size.width(), size.height()
    e = Qt.Edge(0)
    if x < m or (x < corner and (y < m or y > h - m)):
        e |= Qt.Edge.LeftEdge
    if x > w - m or (x > w - corner and (y < m or y > h - m)):
        e |= Qt.Edge.RightEdge
    if y < m or (y < corner and (x < m or x > w - m)):
        e |= Qt.Edge.TopEdge
    if y > h - m or (y > h - corner and (x < m or x > w - m)):
        e |= Qt.Edge.BottomEdge
    return e


def cursor_for(edges):
    L, R, T, B = Qt.Edge.LeftEdge, Qt.Edge.RightEdge, Qt.Edge.TopEdge, Qt.Edge.BottomEdge
    if (edges & L and edges & T) or (edges & R and edges & B):
        return Qt.CursorShape.SizeFDiagCursor
    if (edges & R and edges & T) or (edges & L and edges & B):
        return Qt.CursorShape.SizeBDiagCursor
    if edges & (L | R):
        return Qt.CursorShape.SizeHorCursor
    if edges & (T | B):
        return Qt.CursorShape.SizeVerCursor
    return None
