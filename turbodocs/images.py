"""Inline images as a custom text object: scales to its container and crops without altering pixels."""
import uuid
from collections import OrderedDict

from PySide6.QtCore import QRectF, QSizeF, Qt
from PySide6.QtGui import QImage, QPyTextObject, QTextCharFormat, QTextCursor, QTextFormat

IMG_TYPE = int(QTextFormat.ObjectTypes.UserObject) + 1
P_ID = QTextFormat.UserProperty + 10
P_W = QTextFormat.UserProperty + 11
P_H = QTextFormat.UserProperty + 12
P_CROP = QTextFormat.UserProperty + 13   # "l,t,r,b" as fractions of the original
MIN_SIZE = 24
ZOOM = 1.0   # view zoom; document sizes stay logical, only the laid-out/painted size is scaled


class Entry:
    def __init__(self, img: QImage, blob: bytes | None = None, ext: str = "png"):
        self.img, self.blob, self.ext = img, blob, ext


REGISTRY: dict[str, Entry] = {}


def register(img: QImage, blob=None, ext="png") -> str:
    key = uuid.uuid4().hex
    REGISTRY[key] = Entry(img, blob, ext)
    return key


def make_format(key, w, h, crop=(0.0, 0.0, 0.0, 0.0)) -> QTextCharFormat:
    f = QTextCharFormat()
    f.setObjectType(IMG_TYPE)
    f.setProperty(P_ID, key)
    f.setProperty(P_W, float(w))
    f.setProperty(P_H, float(h))
    f.setProperty(P_CROP, ",".join(f"{v:.5f}" for v in crop))
    return f


def read_format(fmt):
    """-> (id, want_w, want_h, (l, t, r, b))"""
    try:
        crop = tuple(float(v) for v in str(fmt.property(P_CROP)).split(","))
        if len(crop) != 4:
            raise ValueError
    except ValueError:
        crop = (0.0, 0.0, 0.0, 0.0)
    return str(fmt.property(P_ID)), float(fmt.property(P_W) or 0), float(fmt.property(P_H) or 0), crop


def fit_size(img_key, want_w, want_h, crop, max_w):
    """Final display size: requested size, shrunk (keeping proportions) to fit max_w."""
    w, h = max(want_w, MIN_SIZE), max(want_h, MIN_SIZE)
    if max_w > 0 and w > max_w:
        h, w = h * max_w / w, max_w
    return w, h


def avail_width(doc, pos) -> float:
    """Horizontal room for an inline object at `pos`: the column, or the table cell it sits in."""
    page_w = doc.pageSize().width() / ZOOM
    inner = (page_w if page_w > 0 else 700) - 2 * doc.documentMargin()
    c = QTextCursor(doc.findBlock(pos))  # not setPosition(): that would re-enter the layout
    table = c.currentTable()
    if table is None:
        return max(MIN_SIZE, inner - 2)
    tf = table.format()
    wl = tf.width()
    tw = inner * (wl.rawValue() / 100.0) if wl.type() == wl.Type.PercentageLength else inner
    cons = tf.columnWidthConstraints()
    ncols = table.columns()
    cell = table.cellAt(c)
    share = 0.0
    for i in range(cell.column(), cell.column() + cell.columnSpan()):
        if len(cons) == ncols and cons[i].type() == cons[i].Type.PercentageLength:
            share += cons[i].rawValue() / 100.0
        else:
            share += 1.0 / ncols
    return max(MIN_SIZE, tw * share - 2 * tf.cellPadding() - 4)


class ImageHandler(QPyTextObject):
    def __init__(self):
        super().__init__()
        self._cache: OrderedDict = OrderedDict()

    def intrinsicSize(self, doc, pos, fmt):
        key, w, h, crop = read_format(fmt)
        w, h = fit_size(key, w, h, crop, avail_width(doc, pos))
        return QSizeF(w * ZOOM, h * ZOOM)

    def drawObject(self, painter, rect, doc, pos, fmt):
        key, _w, _h, crop = read_format(fmt)
        entry = REGISTRY.get(key)
        if entry is None:
            painter.setPen(Qt.GlobalColor.gray)
            painter.drawRect(rect)
            return
        pix = self._scaled(entry.img, key, crop, rect, painter.device().devicePixelRatioF())
        painter.drawImage(rect.topLeft(), pix)

    def _scaled(self, img, key, crop, rect, dpr):
        tw, th = max(1, round(rect.width() * dpr)), max(1, round(rect.height() * dpr))
        ck = (key, crop, tw, th)
        pix = self._cache.get(ck)
        if pix is None:
            l, t, r, b = crop
            W, H = img.width(), img.height()
            src = QRectF(l * W, t * H, W * (1 - l - r), H * (1 - t - b)).toAlignedRect()
            pix = img.copy(src).scaled(tw, th, Qt.AspectRatioMode.IgnoreAspectRatio,
                                       Qt.TransformationMode.SmoothTransformation)
            pix.setDevicePixelRatio(dpr)
            self._cache[ck] = pix
            if len(self._cache) > 24:
                self._cache.popitem(last=False)
        return pix


def format_at(doc, pos):
    """Char format of the character at `pos` (works for object characters)."""
    block = doc.findBlock(pos)
    for it in block:
        frag = it.fragment()
        if frag.position() <= pos < frag.position() + frag.length():
            return frag.charFormat()
    return None


def is_image(fmt) -> bool:
    return fmt is not None and fmt.objectType() == IMG_TYPE
