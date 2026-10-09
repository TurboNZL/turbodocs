"""Liquid Glass: panels, menus, popups and the toolbar dock are frosted copies of the TurboDocs content behind them
(never the desktop). The picture behind a widget is grabbed, Gaussian-blurred at full resolution, tinted and painted
under the widget's own styling."""
import weakref

from PySide6.QtCore import QEvent, QObject, QPoint, QRect, QRectF, Qt, QTimer
from PySide6.QtGui import QColor, QImage, QLinearGradient, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import (QApplication, QGraphicsBlurEffect, QGraphicsPixmapItem, QGraphicsScene, QMenu,
                               QWidget)

from . import theme

BLUR = 14           # Gaussian radius in logical pixels
OVERLAYS = ("Floating", "FindBar", "Dock")      # children of the canvas, frosted from the page under them
POPUPS = ("Popup",)                              # top-level popups, frosted from the window behind them
_overlays = weakref.WeakSet()
_gen = 0
_timer = None


def blur(pm: QPixmap, radius=BLUR) -> QPixmap:
    scene = QGraphicsScene()
    item = QGraphicsPixmapItem(pm)
    eff = QGraphicsBlurEffect()
    eff.setBlurRadius(radius)
    eff.setBlurHints(QGraphicsBlurEffect.BlurHint.QualityHint)
    item.setGraphicsEffect(eff)
    scene.addItem(item)
    dpr = pm.devicePixelRatio()
    img = QImage(pm.size(), QImage.Format.Format_ARGB32_Premultiplied)
    img.setDevicePixelRatio(dpr)
    img.fill(Qt.GlobalColor.transparent)
    p = QPainter(img)
    size = pm.size() / dpr
    scene.render(p, QRectF(0, 0, size.width(), size.height()), QRectF(0, 0, size.width(), size.height()))
    p.end()
    return QPixmap.fromImage(img)


def frost(source: QWidget, area: QRect) -> QPixmap | None:
    """Blurred picture of `area` (in source coordinates). Grabs a margin around it so the edges blur properly."""
    pad = BLUR * 2
    big = area.adjusted(-pad, -pad, pad, pad)       # may stick out of the source; that part is filled, then cropped away
    src = big.intersected(source.rect())
    if src.isEmpty():
        return None
    pm = source.grab(src)
    if pm.isNull():
        return None
    dpr = pm.devicePixelRatio()
    base = QPixmap(big.size() * dpr)
    base.setDevicePixelRatio(dpr)
    base.fill(QColor(theme.cur["bg"]))      # outside the window the blur has nothing to sample
    p = QPainter(base)
    p.drawPixmap(src.topLeft() - big.topLeft(), pm)
    p.end()
    out = blur(base).copy(QRect(QPoint(pad, pad) * dpr, area.size() * dpr))
    out.setDevicePixelRatio(dpr)
    return out


def _light():
    return not theme.cur.get("dark", False) and QColor(theme.cur["chrome"]).lightness() > 128


def paint(widget: QWidget, pm: QPixmap | None, radius: float):
    """Frosted fill, a milky tint and a bright specular rim, clipped to the widget's rounded outline."""
    if pm is None:
        return
    r = QRectF(widget.rect()).adjusted(.5, .5, -.5, -.5)
    path = QPainterPath()
    path.addRoundedRect(r, radius, radius)
    p = QPainter(widget)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setClipPath(path)
    p.drawPixmap(0, 0, pm)
    light = _light()
    p.fillRect(widget.rect(), QColor(222, 230, 245, 105) if light else QColor(30, 32, 40, 105))
    sheen = QLinearGradient(0, 0, 0, widget.height())
    sheen.setColorAt(0, QColor(255, 255, 255, 120 if light else 46))
    sheen.setColorAt(.35, QColor(255, 255, 255, 0))
    p.fillRect(widget.rect(), sheen)
    p.setClipping(False)
    p.setBrush(Qt.BrushStyle.NoBrush)
    p.setPen(QColor(60, 80, 120, 70) if light else QColor(0, 0, 0, 120))
    p.drawPath(path)                                    # edge shading, so glass reads against a white page
    inner = QPainterPath()
    inner.addRoundedRect(r.adjusted(1, 1, -1, -1), radius - 1, radius - 1)
    p.setPen(QColor(255, 255, 255, 210 if light else 60))
    p.drawPath(inner)                                   # specular rim
    p.end()


def invalidate():
    """Content behind the overlays changed (scroll, typing, resize): refresh them soon, but not on every event."""
    global _timer
    if _timer is None:
        _timer = QTimer()
        _timer.setSingleShot(True)
        _timer.setInterval(40)
        _timer.timeout.connect(_refresh)
    if not _timer.isActive():
        _timer.start()


def _refresh():
    global _gen
    _gen += 1
    for w in list(_overlays):
        if w.isVisible():
            w.update()


def _page(canvas: QWidget):
    lay = canvas.layout()
    return lay.currentWidget() if lay is not None and hasattr(lay, "currentWidget") else None


class Glass(QObject):
    """Application-wide filter: makes the popups translucent before they are created and paints the frost."""

    def eventFilter(self, obj, ev):
        if not theme.translucent_on or not isinstance(obj, QWidget):
            return False
        t = ev.type()
        name = obj.objectName()
        if isinstance(obj, QMenu) or (name in POPUPS and obj.isWindow()):
            if t == QEvent.Type.Polish:     # before the native popup exists
                obj.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
                obj.setWindowFlag(Qt.WindowType.FramelessWindowHint)
                obj.setWindowFlag(Qt.WindowType.NoDropShadowWindowHint)
            elif t == QEvent.Type.Show:
                win = (obj.parentWidget() or QApplication.activeWindow() or obj).window()
                if win is not obj:
                    tl = win.mapFromGlobal(obj.mapToGlobal(QPoint(0, 0)))
                    obj._glass = frost(win, QRect(tl, obj.size()))
            elif t == QEvent.Type.Paint and getattr(obj, "_glass", None) is not None:
                paint(obj, obj._glass, 18)
        elif name in OVERLAYS and not obj.isWindow():
            if t == QEvent.Type.Show:
                _overlays.add(obj)
            elif t == QEvent.Type.Paint:
                canvas = obj.parentWidget()
                page = _page(canvas) if canvas is not None else None
                if page is not None and (getattr(obj, "_glass", None) is None or getattr(obj, "_gen", None) != _gen):
                    tl = page.mapFromGlobal(obj.mapToGlobal(QPoint(0, 0)))
                    obj._glass = frost(page, QRect(tl, obj.size()))
                    obj._gen = _gen
                paint(obj, getattr(obj, "_glass", None), obj.property("glassRadius") or 18)
        return False
