"""Interface animations: buttons and cards fade between rest and hover, menus/dialogs/popups fade in, and the
editor scrolls smoothly. How long each takes comes from the interface style (theme.fx); XP, Windows 95 and
Terminal are deliberately instant, like the originals."""
from PySide6.QtCore import QEasingCurve, QEvent, QObject, QPropertyAnimation, QVariantAnimation
from PySide6.QtWidgets import QDialog, QMenu, QPushButton, QToolButton, QWidget

from . import theme
from .prefs import prefs

_SKIP = "nofx"


class Animator(QObject):
    def __init__(self, app):
        super().__init__(app)
        self._anims = {}          # widget -> QVariantAnimation (value = hover amount 0..1)
        self._fades = {}
        app.installEventFilter(self)

    # ---- helpers
    @staticmethod
    def _on():
        return prefs.get("animations") and theme.fx.get("ms", 0) > 0

    @staticmethod
    def _spec(w):
        if w.objectName() == "Card":
            return theme.fx.get("card")
        if isinstance(w, QToolButton):
            return theme.fx.get("tool")
        if isinstance(w, QPushButton):
            return theme.fx.get("push_default") if w.isDefault() else theme.fx.get("push")
        return None

    def _eligible(self, w):
        if not isinstance(w, QWidget) or not w.isEnabled() or w.property(_SKIP) or w.styleSheet():
            return False
        if isinstance(w, (QPushButton, QToolButton)):
            return not (w.isChecked() or w.isDown())
        return w.objectName() == "Card"

    def _apply(self, w, t):
        spec = self._spec(w)
        if not spec:
            return
        fill, fill_h, brd, brd_h, bot, bot_h = spec
        sel = "#Card" if w.objectName() == "Card" else ("QToolButton" if isinstance(w, QToolButton) else "QPushButton")
        side = theme.col_css(theme.lerp_color(brd, brd_h, t))
        # elevation borders: the bottom edge has its own colour, which must survive the animation
        bottom = theme.col_css(theme.lerp_color(bot if bot is not None else brd, bot_h if bot_h is not None else brd_h, t))
        w.setStyleSheet(f"{sel} {{ background: {theme.fill_css(theme.lerp_fill(fill, fill_h, t))}; "
                        f"border-color: {side} {side} {bottom} {side}; }}")

    def _go(self, w, target):
        a = self._anims.get(w)
        start = a.currentValue() if a else (0.0 if target else 1.0)
        if a:
            a.stop()
        else:
            a = QVariantAnimation(self)
            a.valueChanged.connect(lambda v, w=w: self._apply(w, v))
            a.finished.connect(lambda w=w: self._settled(w))
            self._anims[w] = a
            w.destroyed.connect(lambda _=None, w=w: self._anims.pop(w, None))
        a.setEasingCurve(QEasingCurve.Type.Linear if theme.fx.get("ease") == "linear" else QEasingCurve.Type.OutCubic)
        a.setStartValue(float(start))
        a.setEndValue(float(target))
        a.setDuration(max(int(theme.fx["ms"] * abs(target - start)), 1))
        a.start()

    def _settled(self, w):
        a = self._anims.get(w)
        if a is not None and a.endValue() == 0.0:
            w.setStyleSheet("")      # back at rest: hand control back to the stylesheet

    def _kill(self, w):
        a = self._anims.get(w)
        if a:
            a.stop()
            try:
                w.setStyleSheet("")
            except RuntimeError:
                pass

    def _fade_in(self, w):
        ms = theme.fx.get("fade", 0)
        if not (ms and prefs.get("animations")):
            return
        a = self._fades.get(w)
        if a is None:
            a = QPropertyAnimation(w, b"windowOpacity", self)
            a.setEasingCurve(QEasingCurve.Type.OutCubic)
            self._fades[w] = a
            w.destroyed.connect(lambda _=None, w=w: self._fades.pop(w, None))
        a.stop()
        a.setDuration(ms)
        a.setStartValue(0.0)
        a.setEndValue(1.0)
        w.setWindowOpacity(0.0)
        a.start()

    # ---- event filter
    def eventFilter(self, obj, ev):
        t = ev.type()
        if t == QEvent.Type.Enter:
            if self._on() and self._eligible(obj):
                self._go(obj, 1.0)
        elif t == QEvent.Type.Leave:
            if obj in self._anims and self._on():
                if obj.styleSheet() or self._anims[obj].currentValue():
                    self._go(obj, 0.0)
        elif t in (QEvent.Type.MouseButtonPress, QEvent.Type.Hide, QEvent.Type.EnabledChange):
            if obj in self._anims:
                self._kill(obj)
        elif t == QEvent.Type.Show:
            if isinstance(obj, (QMenu, QDialog)) or (isinstance(obj, QWidget) and obj.objectName() == "Popup"):
                if obj.isWindow():
                    self._fade_in(obj)
        return False


def smooth_scroll(bar, delta_px):
    """Glide a scrollbar by delta_px instead of jumping."""
    a = getattr(bar, "_glide", None)
    if a is None:
        a = QPropertyAnimation(bar, b"value", bar)
        a.setEasingCurve(QEasingCurve.Type.OutCubic)
        bar._glide = a
    target = (a.endValue() if a.state() == a.State.Running else bar.value()) - delta_px
    target = max(bar.minimum(), min(bar.maximum(), int(target)))
    a.stop()
    a.setDuration(170)
    a.setStartValue(bar.value())
    a.setEndValue(target)
    a.start()
