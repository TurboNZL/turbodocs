"""Optional custom window decorations: a themed title bar (caption buttons, drag, double-click maximise) that
follows the interface style, plus the helpers the main window needs to resize a frameless window."""
from PySide6.QtCore import QPointF, QRectF, QSize, Qt, QVariantAnimation
from PySide6.QtGui import (QColor, QFont, QIcon, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap,
                           QPolygonF, QRadialGradient)
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
        base.update(bg=[(0, "#d6e5f7"), (.5, "#c3d8f1"), (1, "#b5cdeb")] if light else
                    [(0, theme.mix(c["chrome"], "#ffffff", .12)), (1, c["chrome"])],
                    fg="#000000" if light else c["text"], h=28, edge=7, btn_w=0, btn_h=20, btn="aero7",
                    inline_menu=False, frame="#3b4f6b" if light else c["border"],
                    frame_fill="#b5cdeb" if light else c["chrome"], frame_hi="#e9f2fc" if light else None,
                    client_border="#6a7d99" if light else None, shine=light, glow=light, frame_glow=light,
                    close="#c9372c", close_press="#a82a20")
    elif kind == "xp":
        base.update(bg=[(0, "#0997ff"), (.08, "#0058ee"), (.4, "#0050d6"), (.9, "#0049c9"), (1, "#003dd7")],
                    fg="#ffffff", bold=True, h=30, btn_w=21, btn_h=21, btn="xp", inline_menu=False, frame="#0831d9",
                    frame_fill="#0831d9", edge=4, close="#e0663d", mono=False)
    elif kind == "classic":
        base.update(bg=[(0, "#000080"), (1, "#1084d0")], fg="#ffffff", bold=True, h=20, btn_w=16, btn_h=14,
                    btn="bevel", inline_menu=False, frame="#000000", frame_fill=c["chrome"], edge=3)
    elif kind == "platinum":
        base.update(layout="mac", h=22, align="center", btn="plat", btn_w=13, bg="#dddddd", fg="#000000",
                    inline_menu=False, frame="#000000", frame_fill="#dddddd", edge=3, stripes=True)
    elif kind == "aqua":
        base.update(layout="mac", h=24, align="center", btn="gel", btn_w=14, inline_menu=False,
                    bg=[(0, "#ececec"), (1, "#c4c4c4")] if light else [(0, theme.mix(c["chrome"], "#ffffff", .1)), (1, c["chrome"])],
                    fg="#000000" if light else c["text"], frame="#6e6e6e" if light else c["border"],
                    frame_fill="#c4c4c4" if light else c["chrome"], edge=1)
    elif kind == "glass":
        base.update(layout="mac", h=40, align="center", btn="mac", btn_w=14, inline_menu=False,
                    bg=[(0, "#f7f9fd"), (1, "#eaeff7")] if light else [(0, theme.mix(c["chrome"], "#ffffff", .05)), (1, c["chrome"])],
                    frame=theme.mix(c["bg"], c["text"], .16), edge=1)
    elif kind in ("gnome", "yaru"):
        base.update(layout="round", h=46 if kind == "gnome" else 40, align="center", bold=kind == "gnome",
                    btn="round", btn_w=28, frame=theme.mix(c["bg"], c["text"], .18),
                    hover=theme.mix(c["chrome"], ink, .12 if light else .14),
                    press=theme.mix(c["chrome"], ink, .2 if light else .22),
                    close=acc if kind == "yaru" else theme.mix(c["chrome"], ink, .12 if light else .14),
                    close_press=acc, close_fg=on_accent if kind == "yaru" else c["text"])
        if kind == "gnome":     # libadwaita headerbar tones
            hb = "#ebebeb" if light else "#303030"
            base.update(bg=hb, frame_fill=hb, frame=theme.mix(hb, "#000000", .2))
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
        if spec["btn"] in ("mac", "round", "gel", "plat"):
            bw = bh = spec["btn_w"]
        elif spec["btn"] == "aero7":
            bw, bh = {MIN: 29, MAX: 27, CLOSE: 47}[self.role], spec["btn_h"]
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
        elif kind == "aero7":
            self._paint_aero7(p, r, down, hv, close)
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
        elif kind == "plat":
            sq = QRectF(r.center().x() - 6.5, r.center().y() - 6.5, 13, 13)
            g = QLinearGradient(sq.topLeft(), sq.bottomRight())
            g.setColorAt(0, QColor("#8a8a8a" if down else "#ffffff"))
            g.setColorAt(1, QColor("#b0b0b0" if down else "#a8a8a8"))
            p.setRenderHint(QPainter.RenderHint.Antialiasing, False)
            p.setPen(QPen(QColor("#000000"), 1))
            p.setBrush(g)
            p.drawRect(sq.adjusted(.5, .5, -.5, -.5))
            if self.role == MAX:
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.drawRect(QRectF(sq.left() + 3.5, sq.top() + 3.5, 4, 4))
            elif self.role == MIN:
                p.drawLine(QPointF(sq.left() + 3, sq.center().y()), QPointF(sq.right() - 3, sq.center().y()))
        elif kind == "gel":
            base = QColor({CLOSE: "#e8483c", MIN: "#f2b820", MAX: "#3fbc2c"}[self.role])
            if not self.window().isActiveWindow():
                base = QColor("#b4b4b4")
            if down:
                base = base.darker(125)
            d = r.width() - 1
            c_ = QRectF(.5, .5, d, d)
            g = QLinearGradient(c_.topLeft(), c_.bottomLeft())
            g.setColorAt(0, base.lighter(165))
            g.setColorAt(.55, base)
            g.setColorAt(1, base.lighter(125))
            p.setPen(QPen(base.darker(175), 1))
            p.setBrush(g)
            p.drawEllipse(c_)
            hl = QLinearGradient(c_.topLeft(), c_.bottomLeft())
            hl.setColorAt(0, QColor(255, 255, 255, 235))
            hl.setColorAt(1, QColor(255, 255, 255, 30))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(hl)
            p.drawEllipse(QRectF(c_.left() + d * .14, c_.top() + d * .05, d * .72, d * .46))
            if self.underMouse() or getattr(self.parent(), "mac_hover", False):
                self._glyph(p, c_.adjusted(3, 3, -3, -3), QColor(0, 0, 0, 170), thin=True, small=True)
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

    def _paint_aero7(self, p, r, down, hv, close):
        """Windows 7 glass caption buttons: a joined group hanging from the top edge (min | max | close)."""
        active = self.window().isActiveWindow()
        rad = 5.0
        path = QPainterPath()
        rr = r.adjusted(0.5, -1, -0.5, -0.5)          # top edge is clipped: the group hangs from the frame
        left = self.role == MIN
        right = self.role == CLOSE
        x0, y0, x1, y1 = rr.left(), rr.top(), rr.right(), rr.bottom()
        path.moveTo(x0, y0)
        path.lineTo(x1, y0)
        path.lineTo(x1, y1 - (rad if right else 0))
        if right:
            path.quadTo(x1, y1, x1 - rad, y1)
        else:
            path.lineTo(x1, y1)
        path.lineTo(x0 + (rad if left else 0), y1)
        if left:
            path.quadTo(x0, y1, x0, y1 - rad)
        else:
            path.lineTo(x0, y1)
        path.closeSubpath()
        if close:
            stops = ([(0, "#f0b9ac"), (.48, "#e68a76"), (.5, "#d2503b"), (1, "#e27a60")] if hv < .5 and not down else
                     [(0, "#f9c3b6"), (.48, "#f08a72"), (.5, "#e5412a"), (1, "#f9805f")])
            if down:
                stops = [(0, "#c9685a"), (.48, "#b64233"), (.5, "#992314"), (1, "#c2503c")]
            if not active and not hv:
                stops = [(0, "#e7d2cd"), (.5, "#d5b3ab"), (.51, "#c99b90"), (1, "#d6b0a6")]
            edge = QColor("#5b1b12")
        else:
            glass = [(0, "#eef5fc"), (.48, "#cfe0f3"), (.5, "#a9c5e8"), (1, "#c5d9f0")]
            lit = [(0, "#f5fbff"), (.48, "#d9eeff"), (.5, "#9ed0fa"), (1, "#c3e7ff")]
            if down:
                stops = [(0, "#a9cdee"), (.48, "#8fbbe6"), (.5, "#6aa3dc"), (1, "#8fc0ec")]
            else:
                stops = [(po, theme.lerp_color(a_, b_, hv).name()) for (po, a_), (_, b_) in zip(glass, lit)]
            edge = QColor("#3f5373")
        g = QLinearGradient(rr.topLeft(), rr.bottomLeft())
        for pos, col in stops:
            g.setColorAt(pos, QColor(col))
        p.setBrush(g)
        p.setPen(QPen(edge, 1))
        p.drawPath(path)
        # inner highlight + hover glow
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.setPen(QPen(QColor(255, 255, 255, 150), 1))
        p.drawPath(path)
        if hv > 0 and not down:
            glow = QRadialGradient(QPointF(rr.center().x(), rr.bottom()), rr.width() * .75)
            glow.setColorAt(0, QColor(255, 250, 200, int(170 * hv)) if close else QColor(150, 220, 255, int(190 * hv)))
            glow.setColorAt(1, QColor(255, 255, 255, 0))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(glow)
            p.drawPath(path)
        # glyph: white with a dark outline, like the real caption glyphs
        c = rr.center()
        x, y, k = round(c.x()) + .5, round(c.y()) + .5 + (1 if close else 0), 4.5 if close else 4.0
        for pen in (QPen(QColor(20, 30, 50, 190), 3.2 if close else 3.0, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap),
                    QPen(QColor("#ffffff"), 1.6 if close else 1.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap)):
            p.setPen(pen)
            p.setBrush(Qt.BrushStyle.NoBrush)
            if self.role == MIN:
                p.drawLine(QPointF(x - 3.5, y + 3), QPointF(x + 3.5, y + 3))
            elif self.role == MAX:
                if self._maximised:
                    p.drawRect(QRectF(x - 4, y - 1, 6, 5))
                    p.drawPolyline([QPointF(x - 2, y - 1), QPointF(x - 2, y - 4), QPointF(x + 4, y - 4), QPointF(x + 4, y + 2), QPointF(x + 2, y + 2)])
                else:
                    p.drawRect(QRectF(x - 4, y - 3.5, 8, 7))
            else:
                p.drawLine(QPointF(x - k + .5, y - k + .5), QPointF(x + k - .5, y + k - .5))
                p.drawLine(QPointF(x - k + .5, y + k - .5), QPointF(x + k - .5, y - k + .5))

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


class GlowLabel(QLabel):
    """Title text with the soft white halo Windows 7 draws behind caption text on glass."""
    glow = False

    def paintEvent(self, e):
        if not self.glow:
            super().paintEvent(e)
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        flags = int(self.alignment()) | int(Qt.TextFlag.TextSingleLine)
        r = self.rect().adjusted(0, 0, -2, 0)
        text = self.fontMetrics().elidedText(self.text(), Qt.TextElideMode.ElideRight, r.width() - 8)
        p.setFont(self.font())
        p.setPen(QColor(255, 255, 255, 40))
        for dx in range(-6, 7):
            for dy in range(-5, 6):
                if dx * dx + dy * dy <= 30:
                    p.drawText(r.translated(dx, dy), flags, text)
        p.setPen(QColor("#000000"))
        p.drawText(r, flags, text)
        p.end()


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
        self.title = GlowLabel()
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
            self.title.glow = bool(spec.get("glow"))
            self.title.update()
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
        lay.setSpacing({"mac": 8 if s["btn"] != "plat" else 6, "round": 6}.get(s["layout"], 2 if s["btn"] in ("xp", "bevel", "aero") else
                                                  -1 if s["btn"] == "aero7" else 0))
        order = (CLOSE, MIN, MAX) if s["layout"] == "mac" else (MIN, MAX, CLOSE)
        for r in order:
            lay.addWidget(self.buttons[r])
            self.buttons[r].show()
        if s["layout"] == "mac":
            lay.setContentsMargins(12, 0, 0, 0)
        elif s["btn"] in ("xp", "bevel", "aero"):
            lay.setContentsMargins(0, 0, 4, 0)
        elif s["btn"] == "aero7":
            lay.setContentsMargins(0, 1, 6, 0)
            for b in self.buttons.values():
                lay.setAlignment(b, Qt.AlignmentFlag.AlignTop)
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

    def _paint_glow(self):
        """Aero glass bloom: white light pooling at the top of the caption and sky-blue haze in the corners."""
        p = QPainter(self)
        active = self.win.isActiveWindow()
        h = self.spec["h"] + self.win.contentsMargins().top()
        w = self.width()
        p.setPen(Qt.PenStyle.NoPen)
        g = QLinearGradient(0, 0, 0, h)
        g.setColorAt(0, QColor(255, 255, 255, 150 if active else 70))
        g.setColorAt(.5, QColor(225, 240, 255, 50 if active else 20))
        g.setColorAt(1, QColor(255, 255, 255, 0))
        p.setBrush(g)
        p.drawRect(0, 0, w, h)
        for cx in (0, w):
            rg = QRadialGradient(QPointF(cx, 0), w * .22)
            rg.setColorAt(0, QColor(150, 205, 255, 130 if active else 50))
            rg.setColorAt(1, QColor(150, 205, 255, 0))
            p.setBrush(rg)
            p.drawRect(0, 0, w, h)
        p.end()

    def _paint_stripes(self):
        """Mac OS 9 Platinum title bar: horizontal pinstripes either side of the title text."""
        p = QPainter(self)
        h = self.spec["h"]
        t = self.title
        tw = min(t.width(), t.fontMetrics().horizontalAdvance(t.text()) + 24)
        gap_l = t.x() + (t.width() - tw) // 2
        gap_r = gap_l + tw
        x0 = self.btn_box.x() + self.btn_box.width() + 4
        x1 = self.width() - 6
        for y in range(4, h - 4, 2):
            p.setPen(QColor("#ffffff"))
            p.drawLine(x0, y, gap_l, y)
            p.drawLine(gap_r, y, x1, y)
            p.setPen(QColor("#8f8f8f"))
            p.drawLine(x0, y + 1, gap_l, y + 1)
            p.drawLine(gap_r, y + 1, x1, y + 1)
        p.end()

    def paintEvent(self, e):
        super().paintEvent(e)
        if self.custom and self.spec.get("stripes") and not self.win.isFullScreen():
            self._paint_stripes()
        if self.custom and self.spec.get("frame_glow") and not self.win.isFullScreen():
            self._paint_glow()
        if not (self.custom and self.spec.get("shine")) or self.win.isFullScreen():
            return
        # Aero glass: two soft diagonal reflections across the caption area
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.spec["h"] + self.win.contentsMargins().top()
        p.setPen(Qt.PenStyle.NoPen)
        for x0, x1, a in ((.18, .42, 46), (.56, .66, 30)):
            g = QLinearGradient(0, 0, 0, h)
            g.setColorAt(0, QColor(255, 255, 255, a))
            g.setColorAt(1, QColor(255, 255, 255, 4))
            p.setBrush(g)
            p.drawPolygon(QPolygonF([QPointF(w * x0, 0), QPointF(w * x1, 0), QPointF(w * (x1 - .12), h), QPointF(w * (x0 - .12), h)]))
        p.setPen(QColor(255, 255, 255, 110))
        p.drawLine(0, 0, w, 0)
        p.end()

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
