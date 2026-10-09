"""Pageless rich-text editor: centred column, image resize/crop, table column dragging, find, autocorrect."""
import re

from PySide6.QtCore import QEvent, QPointF, QRectF, QRegularExpression, QSizeF, Qt, QTimer, Signal
from PySide6.QtGui import (QAction, QColor, QFont, QImage, QGuiApplication, QPainter, QPen, QTextBlockFormat, QTextCharFormat,
                           QTextCursor, QTextDocument, QTextFormat, QTextLength)
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QTextEdit, QToolButton

from . import docx_io, images, styles, theme
from .animation import smooth_scroll
from .document import DOC_MARGIN
from .prefs import prefs

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")
HANDLE = 9.0
MIN_COL_PCT = 4.0
HIGHLIGHT_FG = docx_io.HIGHLIGHT_FG
HL_COLORS = [("Yellow", "#fff176"), ("Green", "#a5d6a7"), ("Cyan", "#81d4fa"), ("Pink", "#f48fb1"),
             ("Orange", "#ffcc80"), ("Purple", "#ce93d8"), ("Gray", "#cfd8dc")]
FONT_STEPS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]
EMOJI_CODES = {
    "smile": "😄", "grin": "😁", "joy": "😂", "rofl": "🤣", "blush": "😊", "wink": "😉", "heart_eyes": "😍",
    "sunglasses": "😎", "thinking": "🤔", "sweat_smile": "😅", "cry": "😢", "sob": "😭", "laughing": "😆",
    "party": "🥳", "heart": "❤️", "fire": "🔥", "tada": "🎉", "rocket": "🚀", "eyes": "👀", "wave": "👋",
    "clap": "👏", "pray": "🙏", "ok_hand": "👌", "muscle": "💪", "thumbsup": "👍", "+1": "👍",
    "thumbsdown": "👎", "-1": "👎", "raised_hands": "🙌", "point_right": "👉", "100": "💯", "star": "⭐",
    "sparkles": "✨", "check": "✅", "x": "❌", "warning": "⚠️", "bulb": "💡", "coffee": "☕", "zap": "⚡",
    "sun": "☀️", "moon": "🌙", "snowflake": "❄️", "bug": "🐛", "memo": "📝", "book": "📚", "pizza": "🍕",
    "beer": "🍺", "cake": "🎂",
}
MD_PREFIX = {"-": "Bulleted list", "*": "Bulleted list", "1.": "Numbered list", "#": "Heading 1",
             "##": "Heading 2", "###": "Heading 3"}


class ImageBar(QFrame):
    """Small floating toolbar shown above a selected image."""
    cropRequested = Signal()
    resetRequested = Signal()
    originalRequested = Signal()

    def __init__(self, parent):
        super().__init__(parent)
        self.setObjectName("ImageBar")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(6, 4, 6, 4)
        lay.setSpacing(2)
        self.label = QLabel()
        self.label.setObjectName("Muted")
        for text, sig, tip in (("Crop", self.cropRequested, "Crop image (double-click)"),
                               ("Original size", self.originalRequested, "Restore the image's natural size"),
                               ("Reset", self.resetRequested, "Remove cropping and restore the original")):
            b = QToolButton()
            b.setText(text)
            b.setToolTip(tip)
            b.clicked.connect(sig)
            lay.addWidget(b)
        lay.addWidget(self.label)
        self.hide()


class Editor(QTextEdit):
    layoutChanged = Signal()
    zoomWheel = Signal(int)   # raw wheel delta (120 = one notch) from Ctrl+scroll
    styleChanged = Signal()   # emitted after a paragraph-style update so other tabs can restyle

    def __init__(self):
        super().__init__()
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.setAcceptRichText(True)
        self.viewport().setMouseTracking(True)
        self.text_width, self.margin_left, self.margin_right = 760, 0, 0
        self.page_color = ""
        self.zoom = 1.0
        self._zoom_dev = None
        self._drag = None
        self._crop = None
        self._hover_border = None
        self._cursor_overridden = False
        self._find_extra, self._force_plain = [], False
        self.image_bar = ImageBar(self.viewport())
        self.image_bar.cropRequested.connect(self.start_crop)
        self.image_bar.resetRequested.connect(self.reset_image)
        self.image_bar.originalRequested.connect(self.original_image_size)
        self.cursorPositionChanged.connect(self._on_cursor_moved)
        self.selectionChanged.connect(self._sync_overlays)
        self.verticalScrollBar().valueChanged.connect(self._sync_overlays)
        self.apply_prefs()

    # ------------------------------------------------------------ documents
    top_inset = 0       # room above the first line for the floating toolbar dock

    def set_top_inset(self, px):
        if px != self.top_inset:
            self.top_inset = px
            self._apply_inset(self.document())
            self._update_margins()

    def _apply_inset(self, doc):
        rf = doc.rootFrame()
        ff = rf.frameFormat()
        ff.setTopMargin(DOC_MARGIN + self.top_inset)
        rf.setFrameFormat(ff)

    def set_document(self, doc: QTextDocument):
        self._cancel_crop()
        self.setDocument(doc)
        doc.setDocumentMargin(DOC_MARGIN)
        self._apply_inset(doc)
        self._apply_zoom(doc)
        self._update_margins()
        self.setTextCursor(QTextCursor(doc))
        self._sync_overlays()

    def apply_prefs(self):
        self.setCursorWidth(prefs.get("cursor_width"))
        self._on_cursor_moved()

    def changeEvent(self, e):
        super().changeEvent(e)
        if e.type() == QEvent.Type.FontChange and self.document() is not None:
            # QTextEdit copies the widget font (changed by every theme/appearance switch) into the document's
            # default font; the document's own font must never follow the interface.
            meta = getattr(self.document(), "meta", None)
            if meta is not None:
                self.document().setDefaultFont(meta.styles.base_font())

    # ------------------------------------------------------------ zoom
    def set_zoom(self, z: float):
        """View zoom (1.0 = 100%). Done by laying the document out on a higher-DPI device: unlike QTextEdit.zoomIn
        this scales explicitly sized text, margins, tables and (via images.ZOOM) images, and viewport
        coordinates stay consistent with the layout."""
        z = max(0.25, min(5.0, float(z)))
        if abs(z - self.zoom) < 1e-6:
            return
        bar = self.verticalScrollBar()
        ratio = z / self.zoom
        old = bar.value()
        self.zoom = z
        images.ZOOM = z
        self._apply_zoom(self.document())
        self._update_margins()
        self.layoutChanged.emit()
        bar.setValue(round(old * ratio))
        QTimer.singleShot(0, lambda: bar.setValue(round(old * ratio)))
        self._sync_overlays()

    def _apply_zoom(self, doc):
        images.ZOOM = self.zoom
        if abs(self.zoom - 1.0) < 1e-6:
            self._zoom_dev = None
        else:
            base = QGuiApplication.primaryScreen().logicalDotsPerInchY()
            dev = QImage(1, 1, QImage.Format.Format_ARGB32)
            dpm = round(base / 0.0254 * self.zoom)
            dev.setDotsPerMeterX(dpm)
            dev.setDotsPerMeterY(dpm)
            self._zoom_dev = dev
        doc.documentLayout().setPaintDevice(self._zoom_dev)
        doc.markContentsDirty(0, max(0, doc.characterCount() - 1))

    @property
    def styles(self) -> styles.DocStyles:
        return self.document().meta.styles

    # ------------------------------------------------------------ page colour (per document)
    def set_page_color(self, color: str):
        """Background of this document's canvas; text flips light/dark to stay readable. '' = colour theme."""
        self.page_color = color
        if not color:
            self.setStyleSheet("")
        else:
            c = QColor(color)
            text = "#1f1f1f" if c.lightnessF() > 0.55 else "#e8e8e8"
            sel = theme.mix(color, theme.cur["accent"], 0.45)
            self.setStyleSheet(f"QTextEdit {{ background: {color}; color: {text}; selection-background-color: {sel}; }}")
        self.viewport().update()

    def canvas_color(self) -> QColor:
        return QColor(getattr(self, "page_color", "") or theme.cur["bg"])

    # ------------------------------------------------------------ column geometry
    def set_layout(self, width, left, right):
        self.text_width, self.margin_left, self.margin_right = width, left, right
        self._update_margins()
        self.layoutChanged.emit()

    def _update_margins(self):
        z = self.zoom
        column = (self.text_width + 2 * DOC_MARGIN) * z
        side = max(0, int((self.width() - column) // 2))
        left, right = side + int(self.margin_left * z), side + int(self.margin_right * z)
        limit = max(0, self.width() - 240)
        if left + right > limit:
            scale = limit / (left + right)
            left, right = int(left * scale), int(right * scale)
        self.setViewportMargins(left, 0, right, 0)
        self.document().setPageSize(QSizeF(self.viewport().width(), -1))
        self.document().markContentsDirty(0, max(0, self.document().characterCount() - 1))  # re-measure images
        self._sync_overlays()

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self._update_margins()

    # ------------------------------------------------------------ range formatting helpers
    def _rewrite(self, start, end, fn):
        """Apply fn(QTextCharFormat) -> QTextCharFormat to every fragment in [start, end)."""
        doc = self.document()
        spans, block = [], doc.findBlock(start)
        while block.isValid() and block.position() < end:
            for it in block:
                frag = it.fragment()
                a, b = max(frag.position(), start), min(frag.position() + frag.length(), end)
                if a < b:
                    spans.append((a, b, QTextCharFormat(frag.charFormat())))
            block = block.next()
        c = QTextCursor(doc)
        c.beginEditBlock()
        for a, b, f in spans:
            c.setPosition(a)
            c.setPosition(b, QTextCursor.MoveMode.KeepAnchor)
            c.setCharFormat(fn(f))
        c.endEditBlock()

    def _selected_blocks(self):
        cur = self.textCursor()
        start, end = sorted((cur.selectionStart(), cur.selectionEnd()))
        block = self.document().findBlock(start)
        while block.isValid() and block.position() <= end:
            yield block
            block = block.next()

    # ------------------------------------------------------------ character formatting
    def merge_format(self, fmt: QTextCharFormat):
        self.mergeCurrentCharFormat(fmt)

    def _is_explicit_color(self, f):
        return (f.hasProperty(QTextFormat.Property.ForegroundBrush) and not f.isAnchor()
                and f.foreground().color().name() not in (*docx_io.DISPLAY_ONLY, theme.cur["text"]))

    def _edit_chars(self, fn):
        """Apply fn to the selection (fragments + empty blocks) or, with no selection, to the typing format."""
        cur = self.textCursor()
        if cur.hasSelection():
            self._rewrite(cur.selectionStart(), cur.selectionEnd(), fn)
            for b in self._selected_blocks():  # empty paragraphs (e.g. table cells) carry the format on the block
                bc = QTextCursor(b)
                bc.setBlockCharFormat(fn(bc.blockCharFormat()))
        else:
            self.setCurrentCharFormat(fn(self.currentCharFormat()))

    def set_highlight(self, color):
        def on(f):
            f.setBackground(QColor(color))
            if not self._is_explicit_color(f):
                f.setForeground(QColor(docx_io.contrast_for(color)))  # keeps highlighted words readable
            return f

        def off(f):
            f.clearBackground()
            if f.hasProperty(QTextFormat.Property.ForegroundBrush) and f.foreground().color().name() in docx_io.DISPLAY_ONLY:
                f.clearForeground()
            return f
        self._edit_chars(on if color else off)

    def set_text_color(self, color):
        accent = QColor(theme.cur["accent"])

        def on(f):
            f.setForeground(QColor(color))
            return f

        def off(f):
            f.clearForeground()
            if f.isAnchor():
                f.setForeground(accent)
            elif f.hasProperty(QTextFormat.Property.BackgroundBrush) and f.background().style() != Qt.BrushStyle.NoBrush:
                f.setForeground(QColor(docx_io.contrast_for(f.background().color())))
            return f
        self._edit_chars(on if color else off)

    def step_font_size(self, direction):
        cur = self.currentCharFormat().fontPointSize() or self.styles.base_size
        sizes = sorted(set(FONT_STEPS + [cur]))
        i = sizes.index(cur) + direction
        f = QTextCharFormat()
        f.setFontPointSize(sizes[max(0, min(i, len(sizes) - 1))])
        self.mergeCurrentCharFormat(f)

    def clear_formatting(self):
        cur = self.textCursor()
        if not cur.hasSelection():
            cur.select(QTextCursor.SelectionType.WordUnderCursor)
        self._rewrite(cur.selectionStart(), cur.selectionEnd(),
                      lambda f: f if images.is_image(f) else QTextCharFormat())
        cur.beginEditBlock()
        for b in self._selected_blocks():
            c = QTextCursor(b)
            c.setPosition(b.position() + b.length() - 1, QTextCursor.MoveMode.KeepAnchor)
            c.mergeCharFormat(self.styles.char_format(styles.key_of_block(b)))
            bf = QTextBlockFormat(b.blockFormat())
            bf.setAlignment(Qt.AlignmentFlag.AlignLeft)
            bf.setIndent(0)
            QTextCursor(b).setBlockFormat(bf)
        cur.endEditBlock()

    def insert_link(self, url, text=""):
        cur = self.textCursor()
        f = QTextCharFormat()
        f.setAnchor(True)
        f.setAnchorHref(url)
        f.setFontUnderline(True)
        f.setForeground(QColor(theme.cur["accent"]))
        if cur.hasSelection():
            cur.mergeCharFormat(f)
        else:
            base = QTextCharFormat(cur.charFormat())
            base.merge(f)
            cur.insertText(text or url, base)
            self.setTextCursor(cur)

    def link_at_cursor(self):
        f = self.textCursor().charFormat()
        return f.anchorHref() if f.isAnchor() else ""

    # ------------------------------------------------------------ paragraph formatting
    def apply_style(self, key):
        st = self.styles
        cur = self.textCursor()
        cur.beginEditBlock()
        start, end = sorted((cur.selectionStart(), cur.selectionEnd()))
        block = self.document().findBlock(start)
        while block.isValid() and block.position() <= end:
            old = styles.key_of_block(block)
            lst = block.textList()
            if lst is not None:
                lst.remove(block)
            old_bf = block.blockFormat()
            bf = st.block_format(key)
            bf.setAlignment(old_bf.alignment())
            if key not in styles.LIST_STYLES:
                bf.setIndent(old_bf.indent() if old == key or old in styles.LIST_STYLES or key == "Normal" else 0)
            QTextCursor(block).setBlockFormat(bf)
            self._restyle_chars(block, old, key)
            block = block.next()
        if key in styles.LIST_STYLES:
            cur.createList(styles.list_format(key, 1))
        cur.endEditBlock()
        self._on_cursor_moved()

    def _restyle_chars(self, block, old, key):
        st = self.styles
        start, end = block.position(), block.position() + block.length() - 1
        typing = QTextCharFormat()
        if st.has_look(old):
            od = st.def_for(old)

            def strip(f):
                for p in (QTextFormat.Property.FontPointSize, QTextFormat.Property.FontWeight,
                          QTextFormat.Property.FontItalic):
                    f.clearProperty(p)
                if od.family:
                    f.clearProperty(QTextFormat.Property.FontFamilies)
                if od.color and f.hasProperty(QTextFormat.Property.ForegroundBrush) and \
                        f.foreground().color().name() == QColor(od.color).name():
                    f.clearForeground()
                return f
            if end > start:
                self._rewrite(start, end, strip)
        if st.has_look(key):
            look = st.char_format(key)
            typing.merge(look)
            if end > start:
                c = QTextCursor(block)
                c.setPosition(end, QTextCursor.MoveMode.KeepAnchor)
                c.mergeCharFormat(look)
        QTextCursor(block).setBlockCharFormat(typing)
        if block.length() == 1 and block.contains(self.textCursor().position()):
            self.setCurrentCharFormat(typing)

    def current_style(self):
        return styles.key_of_block(self.textCursor().block())

    def current_look(self) -> dict:
        """Formatting at the caret, used by 'Update style to match selection'."""
        f, bf = self.currentCharFormat(), self.textCursor().blockFormat()
        fam = ""
        if f.hasProperty(QTextFormat.Property.FontFamilies):
            fams = f.property(QTextFormat.Property.FontFamilies)
            fam = fams[0] if fams else ""
        col = ""
        if f.hasProperty(QTextFormat.Property.ForegroundBrush) and not f.isAnchor():
            c = f.foreground().color().name()
            col = "" if c in (HIGHLIGHT_FG, theme.cur["text"]) else c
        return dict(size=f.fontPointSize() or self.styles.base_size, bold=f.fontWeight() >= QFont.Weight.DemiBold,
                    italic=f.fontItalic(), family=fam, color=col, before=bf.topMargin(), after=bf.bottomMargin(),
                    line=bf.lineHeight() / 100.0 if bf.lineHeight() > 0 else 1.0)

    def set_alignment_flag(self, flag):
        self.setAlignment(flag)

    def change_indent(self, delta):
        cur = self.textCursor()
        blocks = list(self._selected_blocks())
        lists = [b for b in blocks if b.textList() is not None]
        cur.beginEditBlock()
        if lists and len(lists) == len(blocks):
            lf = lists[0].textList().format()
            lf.setIndent(max(1, min(6, lf.indent() + delta)))
            cur.createList(lf)
        else:
            for b in blocks:
                if b.textList() is not None:
                    continue
                bf = b.blockFormat()
                bf.setIndent(max(0, min(8, bf.indent() + delta)))
                QTextCursor(b).setBlockFormat(bf)
        cur.endEditBlock()

    def set_line_spacing(self, mult):
        cur = self.textCursor()
        cur.beginEditBlock()
        for b in self._selected_blocks():
            bf = QTextBlockFormat()
            bf.setLineHeight(mult * 100, QTextBlockFormat.LineHeightTypes.ProportionalHeight.value)
            QTextCursor(b).mergeBlockFormat(bf)
        cur.endEditBlock()

    def set_paragraph_space(self, before=None, after=None):
        cur = self.textCursor()
        cur.beginEditBlock()
        for b in self._selected_blocks():
            bf = QTextBlockFormat()
            if before is not None:
                bf.setTopMargin(before)
            if after is not None:
                bf.setBottomMargin(after)
            QTextCursor(b).mergeBlockFormat(bf)
        cur.endEditBlock()

    def current_line_spacing(self):
        bf = self.textCursor().blockFormat()
        return bf.lineHeight() / 100.0 if bf.lineHeight() > 0 else 1.0

    # ------------------------------------------------------------ images
    def insert_image(self, img: QImage, blob=None, ext="png"):
        if img.isNull():
            return
        cur = self.textCursor()
        key = images.register(img, blob, ext)
        avail = images.avail_width(self.document(), cur.position())
        w, h = img.width(), img.height()
        if w > avail:
            h, w = h * avail / w, avail
        cur.insertText("￼", images.make_format(key, w, h))
        self.setTextCursor(cur)

    def _image_sel(self):
        c = self.textCursor()
        if c.selectionEnd() - c.selectionStart() != 1:
            return None
        p = c.selectionStart()
        fmt = images.format_at(self.document(), p)
        return (p, fmt) if images.is_image(fmt) else None

    def _display_size(self, p, fmt):
        key, w, h, crop = images.read_format(fmt)
        w, h = images.fit_size(key, w, h, crop, images.avail_width(self.document(), p))
        return w * self.zoom, h * self.zoom

    def _img_rect(self, p, fmt) -> QRectF:
        c = QTextCursor(self.document())
        c.setPosition(p)
        r = self.cursorRect(c)
        w, h = self._display_size(p, fmt)
        return QRectF(r.x(), r.bottom() + 1 - h if r.height() >= h else r.y(), w, h)

    def _select_image(self, p):
        c = QTextCursor(self.document())
        c.setPosition(p)
        c.setPosition(p + 1, QTextCursor.MoveMode.KeepAnchor)
        self.setTextCursor(c)

    def _image_at(self, pos):
        c = self.cursorForPosition(pos)
        for p in (c.position(), c.position() - 1):
            if p < 0:
                continue
            fmt = images.format_at(self.document(), p) if p < self.document().characterCount() - 1 else None
            if images.is_image(fmt) and self._img_rect(p, fmt).adjusted(-2, -2, 2, 2).contains(QPointF(pos)):
                return p
        return None

    def _set_img_format(self, p, fmt, join=False):
        c = QTextCursor(self.document())
        c.setPosition(p)
        c.setPosition(p + 1, QTextCursor.MoveMode.KeepAnchor)
        c.joinPreviousEditBlock() if join else c.beginEditBlock()
        c.setCharFormat(fmt)
        c.endEditBlock()
        self._sync_overlays()

    def _handles(self, rect: QRectF):
        return {"tl": rect.topLeft(), "tr": rect.topRight(), "bl": rect.bottomLeft(), "br": rect.bottomRight()}

    def _crop_handles(self, rect: QRectF):
        cx, cy = rect.center().x(), rect.center().y()
        return {"tl": rect.topLeft(), "tr": rect.topRight(), "bl": rect.bottomLeft(), "br": rect.bottomRight(),
                "t": QPointF(cx, rect.top()), "b": QPointF(cx, rect.bottom()),
                "l": QPointF(rect.left(), cy), "r": QPointF(rect.right(), cy)}

    @staticmethod
    def _hit_handle(handles, pos, tol=HANDLE):
        for name, pt in handles.items():
            if abs(pos.x() - pt.x()) <= tol and abs(pos.y() - pt.y()) <= tol:
                return name
        return None

    CURSORS = {"tl": Qt.CursorShape.SizeFDiagCursor, "br": Qt.CursorShape.SizeFDiagCursor,
               "tr": Qt.CursorShape.SizeBDiagCursor, "bl": Qt.CursorShape.SizeBDiagCursor,
               "t": Qt.CursorShape.SizeVerCursor, "b": Qt.CursorShape.SizeVerCursor,
               "l": Qt.CursorShape.SizeHorCursor, "r": Qt.CursorShape.SizeHorCursor}

    def start_crop(self):
        st = self._image_sel()
        if not st:
            return
        p, fmt = st
        key, _w, _h, (l, t, r, b) = images.read_format(fmt)
        entry = images.REGISTRY.get(key)
        if entry is None:
            return
        rect = self._img_rect(p, fmt)
        W, H = entry.img.width(), entry.img.height()
        sx = rect.width() / max(1.0, W * (1 - l - r))
        sy = rect.height() / max(1.0, H * (1 - t - b))
        full = QRectF(rect.x() - l * W * sx, rect.y() - t * H * sy, W * sx, H * sy)
        self._crop = dict(p=p, key=key, full=full, box=QRectF(rect), grab=None)
        self.viewport().update()

    def _cancel_crop(self):
        if self._crop:
            self._crop = None
            self.viewport().update()

    def _commit_crop(self):
        c = self._crop
        self._crop = None
        if not c:
            return
        full, box = c["full"], c["box"]
        crop = ((box.left() - full.left()) / full.width(), (box.top() - full.top()) / full.height(),
                (full.right() - box.right()) / full.width(), (full.bottom() - box.bottom()) / full.height())
        fmt = images.make_format(c["key"], box.width() / self.zoom, box.height() / self.zoom,
                                 tuple(max(0.0, v) for v in crop))
        self._set_img_format(c["p"], fmt)
        self.viewport().update()

    def reset_image(self):
        st = self._image_sel()
        if not st:
            return
        p, fmt = st
        key, w, h, (l, t, r, b) = images.read_format(fmt)
        entry = images.REGISTRY.get(key)
        if entry is None:
            return
        W, H = entry.img.width(), entry.img.height()
        scale = w / max(1.0, W * (1 - l - r))
        self._set_img_format(p, images.make_format(key, W * scale, H * scale))

    def original_image_size(self):
        st = self._image_sel()
        if not st:
            return
        p, fmt = st
        key, _w, _h, crop = images.read_format(fmt)
        entry = images.REGISTRY.get(key)
        if entry:
            l, t, r, b = crop
            self._set_img_format(p, images.make_format(key, entry.img.width() * (1 - l - r),
                                                       entry.img.height() * (1 - t - b), crop))

    # ------------------------------------------------------------ overlays
    def _sync_overlays(self, *_):
        st = self._image_sel()
        if not st or self._crop:
            self.image_bar.hide()
        else:
            p, fmt = st
            rect = self._img_rect(p, fmt)
            key, _w, _h, crop = images.read_format(fmt)
            entry = images.REGISTRY.get(key)
            self.image_bar.label.setText(f"  {rect.width():.0f} × {rect.height():.0f}")
            self.image_bar.adjustSize()
            x = max(4, min(rect.left(), self.viewport().width() - self.image_bar.width() - 4))
            y = rect.top() - self.image_bar.height() - 8
            if y < 4:
                y = rect.bottom() + 8
            self.image_bar.move(int(x), int(y))
            self.image_bar.show()
            self.image_bar.raise_()
        self.viewport().update()

    def _on_cursor_moved(self):
        # typing right after an image must not inherit the image object format
        f = self.currentCharFormat()
        if images.is_image(f) and not self.textCursor().hasSelection():
            self.setCurrentCharFormat(QTextCharFormat())
        self._apply_extras()
        self._sync_overlays()

    def paintEvent(self, e):
        super().paintEvent(e)
        p = QPainter(self.viewport())
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        accent = QColor(theme.cur["accent"])
        if self._crop:
            self._paint_crop(p, accent)
        else:
            st = self._image_sel()
            if st:
                rect = self._img_rect(*st)
                p.setPen(QPen(accent, 2))
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.drawRect(rect)
                self._draw_handles(p, self._handles(rect), accent)
        if self._hover_border and not self._drag:
            _t, _i, x, top, bottom = self._hover_border
            p.setPen(QPen(accent, 2))
            p.drawLine(QPointF(x, top), QPointF(x, bottom))
        if self._drag and self._drag["kind"] in ("col", "edge"):
            d = self._drag
            p.setPen(QPen(accent, 2, Qt.PenStyle.DashLine))
            p.drawLine(QPointF(d["x"] + d["dx"], d["top"]), QPointF(d["x"] + d["dx"], d["bottom"]))
        p.end()

    def _draw_handles(self, p, handles, accent):
        p.setPen(QPen(accent, 1.5))
        p.setBrush(QColor("#ffffff"))
        for pt in handles.values():
            p.drawRect(QRectF(pt.x() - HANDLE / 2, pt.y() - HANDLE / 2, HANDLE, HANDLE))

    def _paint_crop(self, p, accent):
        c = self._crop
        entry = images.REGISTRY.get(c["key"])
        if entry is None:
            return
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        p.fillRect(c["full"], self.canvas_color())
        p.setOpacity(0.35)
        p.drawImage(c["full"], entry.img)
        p.setOpacity(1.0)
        p.save()
        p.setClipRect(c["box"])
        p.drawImage(c["full"], entry.img)
        p.restore()
        p.setPen(QPen(accent, 2))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawRect(c["box"])
        p.setPen(QPen(QColor(255, 255, 255, 90), 1))
        b = c["box"]
        for i in (1, 2):
            p.drawLine(QPointF(b.left() + b.width() * i / 3, b.top()), QPointF(b.left() + b.width() * i / 3, b.bottom()))
            p.drawLine(QPointF(b.left(), b.top() + b.height() * i / 3), QPointF(b.right(), b.top() + b.height() * i / 3))
        self._draw_handles(p, self._crop_handles(b), accent)

    # ------------------------------------------------------------ table geometry & editing
    def _table_rect(self, t) -> QRectF:
        """The table's true outer border box in document coordinates.
        Qt's frameBoundingRect starts inside the first cell, so shift it out by padding + border."""
        r = self.document().documentLayout().frameBoundingRect(t)
        pad = t.format().cellPadding() * self.zoom
        return QRectF(r.left() - pad - 1.5, r.top() - pad - 0.5, r.width(), r.height())

    def _border_at(self, pos):
        """-> (table, divider index or -1 for the right edge, x, top, bottom) in viewport coords."""
        c = self.cursorForPosition(pos)
        t = c.currentTable()
        ox, oy = self.horizontalScrollBar().value(), self.verticalScrollBar().value()
        x, y = pos.x() + ox, pos.y() + oy
        if t is None:
            # the outer right edge lies outside the last cell, so probe just inside it
            c = self.cursorForPosition(QPointF(pos.x() - 8, pos.y()).toPoint())
            t = c.currentTable()
            if t is None:
                return None
        rect = self._table_rect(t)
        if not (rect.top() - 2 <= y <= rect.bottom() + 2):
            return None
        top, bottom = rect.top() - oy, rect.bottom() - oy
        tol = 5
        acc, pcts = 0.0, docx_io.col_pcts(t)
        best = None
        for i in range(len(pcts) - 1):
            acc += pcts[i]
            bx = rect.left() + rect.width() * acc / 100.0
            if abs(x - bx) <= tol and (best is None or abs(x - bx) < best[0]):
                best = (abs(x - bx), i, bx)
        right = rect.right()
        if abs(x - right) <= tol and (best is None or abs(x - right) < best[0]):
            best = (abs(x - right), -1, right)
        return None if best is None else (t, best[1], best[2] - ox, top, bottom)

    def table_ctx(self):
        c = self.textCursor()
        t = c.currentTable()
        return (t, t.cellAt(c)) if t is not None else (None, None)

    def _set_pcts(self, table, pcts):
        tf = table.format()
        total = sum(pcts) or 100.0
        tf.setColumnWidthConstraints([QTextLength(QTextLength.Type.PercentageLength, p * 100.0 / total) for p in pcts])
        table.setFormat(tf)

    def insert_table(self, rows, cols):
        cur = self.textCursor()
        cur.beginEditBlock()
        cur.insertTable(rows, cols, docx_io.table_format(cols))
        cur.endEditBlock()

    def table_insert_row(self, below=True):
        t, cell = self.table_ctx()
        if t:
            t.insertRows(cell.row() + (cell.rowSpan() if below else 0), 1)

    def table_insert_col(self, right=True):
        t, cell = self.table_ctx()
        if not t:
            return
        pcts = docx_io.col_pcts(t)
        c = cell.column() + (cell.columnSpan() - 1 if right else 0)
        half = pcts[c] / 2
        pcts[c] = half
        pcts.insert(c + 1 if right else c, half)
        self.textCursor().beginEditBlock()
        t.insertColumns(c + 1 if right else c, 1)
        self._set_pcts(t, pcts)
        self.textCursor().endEditBlock()

    def table_delete_row(self):
        t, cell = self.table_ctx()
        if t and t.rows() > 1:
            t.removeRows(cell.row(), 1)
        elif t:
            self.table_delete()

    def table_delete_col(self):
        t, cell = self.table_ctx()
        if t and t.columns() > 1:
            pcts = docx_io.col_pcts(t)
            pcts.pop(cell.column())
            t.removeColumns(cell.column(), 1)
            self._set_pcts(t, pcts)
        elif t:
            self.table_delete()

    def table_delete(self):
        t, _cell = self.table_ctx()
        if t:
            c = QTextCursor(self.document())
            c.setPosition(t.firstPosition() - 1)
            c.setPosition(t.lastPosition() + 1, QTextCursor.MoveMode.KeepAnchor)
            c.removeSelectedText()

    def set_cell_color(self, color: str):
        """Background for the selected table cells (or the current one); '' clears it."""
        c = self.textCursor()
        t = c.currentTable()
        if t is None:
            return
        if c.hasSelection():
            r0, nr, c0, nc = c.selectedTableCells()
        else:
            cell = t.cellAt(c)
            r0, c0, nr, nc = cell.row(), cell.column(), cell.rowSpan(), cell.columnSpan()
        c.beginEditBlock()
        seen = set()
        for r in range(r0, r0 + nr):
            for col in range(c0, c0 + nc):
                cell = t.cellAt(r, col)
                if (cell.row(), cell.column()) not in seen:
                    seen.add((cell.row(), cell.column()))
                    docx_io.shade_cell(t, cell, color)
        c.endEditBlock()

    def table_merge(self):
        c = self.textCursor()
        t = c.currentTable()
        if t and c.hasSelection():
            t.mergeCells(c)

    def cell_is_merged(self):
        _t, cell = self.table_ctx()
        return bool(cell and (cell.rowSpan() > 1 or cell.columnSpan() > 1))

    def table_split(self, ncols, nrows):
        """Merged cell -> un-merge it. Plain cell -> divide it into ncols x nrows sub-cells."""
        t, cell = self.table_ctx()
        if not t:
            return
        r0, c0 = cell.row(), cell.column()
        cur = self.textCursor()
        cur.beginEditBlock()
        if cell.rowSpan() > 1 or cell.columnSpan() > 1:
            t.splitCell(r0, c0, cell.rowSpan(), cell.columnSpan())
        else:
            if ncols > 1:
                pcts = docx_io.col_pcts(t)
                share = pcts[c0] / ncols
                pcts[c0:c0 + 1] = [share] * ncols
                t.insertColumns(c0 + 1, ncols - 1)
                for r in range(t.rows()):
                    if r == r0:
                        continue
                    other = t.cellAt(r, c0)
                    if other.row() == r and other.column() + other.columnSpan() - 1 == c0:
                        t.mergeCells(r, other.column(), other.rowSpan(), other.columnSpan() + ncols - 1)
                self._set_pcts(t, pcts)
            if nrows > 1:
                t.insertRows(r0 + 1, nrows - 1)
                for c in range(t.columns()):
                    if c0 <= c < c0 + ncols:
                        continue
                    other = t.cellAt(r0, c)
                    if other.column() == c and other.row() + other.rowSpan() - 1 == r0:
                        t.mergeCells(other.row(), c, other.rowSpan() + nrows - 1, other.columnSpan())
        cur.endEditBlock()

    # ------------------------------------------------------------ find / replace
    def find_matches(self, text, case=False, regex=False, limit=5000):
        if not text:
            return []
        doc, out, pos = self.document(), [], 0
        flags = QTextDocument.FindFlag.FindCaseSensitively if case else QTextDocument.FindFlag(0)
        if regex:
            rx = QRegularExpression(text)
            if not case:
                rx.setPatternOptions(QRegularExpression.PatternOption.CaseInsensitiveOption)
            if not rx.isValid():
                return []
            arg = rx
        else:
            arg = text
        while len(out) < limit:
            c = doc.find(arg, pos, flags)
            if c.isNull():
                break
            a, b = c.selectionStart(), c.selectionEnd()
            out.append((a, b))
            pos = b if b > a else b + 1
        return out

    def set_find_highlights(self, matches, current=-1):
        sels = []
        accent = QColor(theme.cur["accent"])
        for i, (a, b) in enumerate(matches):
            s = QTextEdit.ExtraSelection()
            c = QTextCursor(self.document())
            c.setPosition(a)
            c.setPosition(b, QTextCursor.MoveMode.KeepAnchor)
            s.cursor = c
            col = QColor(accent)
            col.setAlpha(150 if i == current else 70)
            s.format.setBackground(col)
            sels.append(s)
        self._find_extra = sels
        self._apply_extras()

    def goto_range(self, a, b):
        c = QTextCursor(self.document())
        c.setPosition(a)
        c.setPosition(b, QTextCursor.MoveMode.KeepAnchor)
        self.setTextCursor(c)
        self.ensureCursorVisible()

    def replace_range(self, a, b, text):
        c = QTextCursor(self.document())
        c.setPosition(a)
        c.setPosition(b, QTextCursor.MoveMode.KeepAnchor)
        fmt = QTextCharFormat(c.charFormat()) if b > a else QTextCharFormat(self.currentCharFormat())
        c.insertText(text, fmt)

    def replace_all(self, matches, text, regex_pattern=None, case=False):
        c = QTextCursor(self.document())
        c.beginEditBlock()
        for a, b in reversed(matches):
            c.setPosition(a)
            c.setPosition(b, QTextCursor.MoveMode.KeepAnchor)
            repl = text
            if regex_pattern is not None:
                try:
                    repl = re.sub(regex_pattern, text.replace("\\n", "\n"), c.selectedText(),
                                  flags=0 if case else re.I)
                except re.error:
                    repl = text
            c.insertText(repl, QTextCharFormat(c.charFormat()))
        c.endEditBlock()

    def _apply_extras(self):
        sels = list(self._find_extra)
        if prefs.get("highlight_line") and not self.textCursor().hasSelection():
            s = QTextEdit.ExtraSelection()
            col = QColor(theme.cur["text"])
            col.setAlpha(14)
            s.format.setBackground(col)
            s.format.setProperty(QTextFormat.Property.FullWidthSelection, True)
            s.cursor = QTextCursor(self.textCursor().block())
            sels.insert(0, s)
        self.setExtraSelections(sels)

    # ------------------------------------------------------------ mouse
    def mousePressEvent(self, e):
        pos = e.position()
        ipos = pos.toPoint()
        if e.button() == Qt.MouseButton.LeftButton:
            if self._crop:
                c = self._crop
                h = self._hit_handle(self._crop_handles(c["box"]), pos)
                if h or c["box"].contains(pos):
                    self._drag = dict(kind="crop", h=h, start=pos, box0=QRectF(c["box"]))
                    return
                self._commit_crop()
            st = self._image_sel()
            if st:
                h = self._hit_handle(self._handles(self._img_rect(*st)), pos)
                if h:
                    p, fmt = st
                    w, hh = self._display_size(p, fmt)
                    self._drag = dict(kind="resize", h=h, start=pos, p=p, fmt=fmt, w0=w, h0=hh, first=True)
                    return
            hit = self._border_at(ipos)
            if hit:
                t, i, x, top, bottom = hit
                width = self._table_rect(t).width()
                self._drag = dict(kind="col" if i >= 0 else "edge", table=t, i=i, x=x, top=top, bottom=bottom,
                                  start=pos, dx=0, pcts=docx_io.col_pcts(t), width=width,
                                  inner=self.viewport().width() - 2 * DOC_MARGIN * self.zoom - 1)
                return
            p = self._image_at(ipos)
            if p is not None:
                self._select_image(p)
                return
        super().mousePressEvent(e)

    def wheelEvent(self, e):
        if e.modifiers() & Qt.KeyboardModifier.ControlModifier:
            dy = e.angleDelta().y() or e.pixelDelta().y()
            if dy:
                self.zoomWheel.emit(dy)
            e.accept()
            return
        if (prefs.get("smooth_scroll") and prefs.get("animations") and e.modifiers() == Qt.KeyboardModifier.NoModifier
                and e.pixelDelta().isNull() and e.angleDelta().y()):
            smooth_scroll(self.verticalScrollBar(), e.angleDelta().y() / 120 * 72)
            e.accept()
            return
        super().wheelEvent(e)

    def mouseMoveEvent(self, e):
        pos = e.position()
        d = self._drag
        if d:
            if d["kind"] == "resize":
                self._drag_resize(pos)
            elif d["kind"] == "edge":
                wl = d["table"].format().width()
                cur_pct = wl.rawValue() if wl.type() == wl.Type.PercentageLength else 100.0
                new_pct = max(25.0, min(100.0, (d["width"] + pos.x() - d["start"].x()) / d["inner"] * 100.0))
                d["dx"], d["new_pct"] = (new_pct - cur_pct) / 100.0 * d["inner"], new_pct
            elif d["kind"] == "col":
                lo = -d["pcts"][d["i"]] + MIN_COL_PCT
                hi = d["pcts"][d["i"] + 1] - MIN_COL_PCT
                dpct = max(lo, min(hi, (pos.x() - d["start"].x()) / d["width"] * 100.0))
                d["dx"], d["dpct"] = dpct / 100.0 * d["width"], dpct
            elif d["kind"] == "crop":
                self._drag_crop(pos)
            self.viewport().update()
            return
        shape = None
        if self._crop:
            h = self._hit_handle(self._crop_handles(self._crop["box"]), pos)
            shape = self.CURSORS.get(h) if h else (Qt.CursorShape.SizeAllCursor if self._crop["box"].contains(pos) else None)
        else:
            st = self._image_sel()
            if st:
                h = self._hit_handle(self._handles(self._img_rect(*st)), pos)
                shape = self.CURSORS.get(h) if h else None
            if shape is None:
                hit = self._border_at(pos.toPoint())
                if hit != self._hover_border:
                    self._hover_border = hit
                    self.viewport().update()
                if hit:
                    shape = Qt.CursorShape.SplitHCursor
        if shape is not None:
            self.viewport().setCursor(shape)
            self._cursor_overridden = True
            return
        if self._cursor_overridden:
            self.viewport().setCursor(Qt.CursorShape.IBeamCursor)
            self._cursor_overridden = False
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e):
        d, self._drag = self._drag, None
        if d:
            if d["kind"] == "edge" and d.get("new_pct"):
                tf = d["table"].format()
                tf.setWidth(QTextLength(QTextLength.Type.PercentageLength, d["new_pct"]))
                d["table"].setFormat(tf)
            if d["kind"] == "col" and d.get("dpct"):
                pcts = list(d["pcts"])
                pcts[d["i"]] += d["dpct"]
                pcts[d["i"] + 1] -= d["dpct"]
                self._set_pcts(d["table"], pcts)
            self.viewport().update()
            self._sync_overlays()
            return
        super().mouseReleaseEvent(e)

    def mouseDoubleClickEvent(self, e):
        p = self._image_at(e.position().toPoint())
        if p is not None:
            self._select_image(p)
            self.start_crop()
            return
        super().mouseDoubleClickEvent(e)

    def leaveEvent(self, e):
        if self._hover_border:
            self._hover_border = None
            self.viewport().update()
        super().leaveEvent(e)

    def _drag_resize(self, pos):
        d = self._drag
        dx = pos.x() - d["start"].x()
        if d["h"] in ("tl", "bl"):
            dx = -dx
        z = self.zoom
        avail = images.avail_width(self.document(), d["p"]) * z
        w = max(images.MIN_SIZE * z, min(avail, d["w0"] + dx))
        h = w * d["h0"] / d["w0"]
        key, _w, _h, crop = images.read_format(d["fmt"])
        self._set_img_format(d["p"], images.make_format(key, w / z, h / z, crop), join=not d["first"])
        d["first"] = False

    def _drag_crop(self, pos):
        d, c = self._drag, self._crop
        full, box = c["full"], QRectF(d["box0"])
        dx, dy = pos.x() - d["start"].x(), pos.y() - d["start"].y()
        h, m = d["h"], 20.0
        if h is None:  # move the whole frame
            box.translate(dx, dy)
            box.moveLeft(max(full.left(), min(box.left(), full.right() - box.width())))
            box.moveTop(max(full.top(), min(box.top(), full.bottom() - box.height())))
        else:
            if "l" in h:
                box.setLeft(max(full.left(), min(box.left() + dx, box.right() - m)))
            if "r" in h:
                box.setRight(min(full.right(), max(box.right() + dx, box.left() + m)))
            if "t" in h:
                box.setTop(max(full.top(), min(box.top() + dy, box.bottom() - m)))
            if "b" in h:
                box.setBottom(min(full.bottom(), max(box.bottom() + dy, box.top() + m)))
        c["box"] = box

    # ------------------------------------------------------------ keyboard & autocorrect
    def keyPressEvent(self, e):
        key, mods = e.key(), e.modifiers()
        if self._crop:
            if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                self._commit_crop()
            elif key == Qt.Key.Key_Escape:
                self._cancel_crop()
            return
        cur = self.textCursor()
        text = e.text()
        plain = not (mods & (Qt.KeyboardModifier.ControlModifier | Qt.KeyboardModifier.AltModifier
                             | Qt.KeyboardModifier.MetaModifier))
        if key in (Qt.Key.Key_Tab, Qt.Key.Key_Backtab) and cur.block().textList() is not None:
            self.change_indent(-1 if key == Qt.Key.Key_Backtab or mods & Qt.KeyboardModifier.ShiftModifier else 1)
            return
        if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter) and not cur.hasSelection():
            block = cur.block()
            was_style = styles.key_of_block(block)
            at_end = cur.position() == block.position() + block.length() - 1
            if block.textList() is not None and block.length() == 1:  # empty list item ends the list
                self.apply_style("Normal")
                return
            super().keyPressEvent(e)
            if at_end and was_style in ("Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3"):
                self.apply_style("Normal")
            return
        if plain and text and not cur.hasSelection() and self._autocorrect(text):
            return
        super().keyPressEvent(e)

    def _autocorrect(self, ch) -> bool:
        cur = self.textCursor()
        block = cur.block()
        before = block.text()[:cur.position() - block.position()]
        if ch == " " and prefs.get("md_shortcuts") and before in MD_PREFIX and \
                styles.key_of_block(block) == "Normal" and block.length() - 1 == len(before):
            cur.beginEditBlock()
            cur.setPosition(block.position())
            cur.setPosition(block.position() + len(before), QTextCursor.MoveMode.KeepAnchor)
            cur.removeSelectedText()
            cur.endEditBlock()
            self.apply_style(MD_PREFIX[before])
            return True
        if ch in ('"', "'") and prefs.get("smart_quotes"):
            opening = not before or before[-1] in " \t\n([{—–- "
            self.insertPlainText({('"', True): "“", ('"', False): "”",
                                  ("'", True): "‘", ("'", False): "’"}[(ch, opening)])
            return True
        if ch == "-" and prefs.get("dashes") and before.endswith("-") and not before.endswith("--"):
            cur.beginEditBlock()
            cur.deletePreviousChar()
            cur.insertText("—", cur.charFormat())
            cur.endEditBlock()
            self.setTextCursor(cur)
            return True
        if ch == ":" and prefs.get("emoji_codes"):
            m = re.search(r":([a-z0-9_+-]+)$", before)
            if m and m.group(1) in EMOJI_CODES:
                cur.beginEditBlock()
                for _ in range(len(m.group(0))):
                    cur.deletePreviousChar()
                cur.insertText(EMOJI_CODES[m.group(1)], cur.charFormat())
                cur.endEditBlock()
                self.setTextCursor(cur)
                return True
        return False

    # ------------------------------------------------------------ clipboard
    def canInsertFromMimeData(self, src):
        return src.hasImage() or super().canInsertFromMimeData(src)

    def paste_plain(self):
        self._force_plain = True
        try:
            self.paste()
        finally:
            self._force_plain = False

    def insertFromMimeData(self, src):
        if src.hasUrls():
            paths = [u.toLocalFile() for u in src.urls() if u.isLocalFile()]
            imgs = [p for p in paths if p.lower().endswith(IMAGE_EXT)]
            if imgs and len(imgs) == len(paths):
                for p in imgs:
                    img = QImage(p)
                    ext = p.lower().rsplit(".", 1)[-1]
                    blob = None
                    if ext in ("png", "jpg", "jpeg"):
                        with open(p, "rb") as fh:
                            blob = fh.read()
                    self.insert_image(img, blob, "jpg" if ext == "jpeg" else ext)
                return
        if src.hasImage() and not src.hasHtml():
            self.insert_image(QImage(src.imageData()))
            return
        if (self._force_plain or prefs.get("paste_plain")) and src.hasText() :
            self.insertPlainText(src.text())
            return
        super().insertFromMimeData(src)

    # ------------------------------------------------------------ context menu
    def contextMenuEvent(self, e):
        menu = self.createStandardContextMenu()
        cur = self.cursorForPosition(e.pos())
        table = cur.currentTable()
        if table is not None:
            if not self.textCursor().currentTable():
                self.setTextCursor(cur)
            menu.addSeparator()
            for text, fn in (
                ("Insert row above", lambda: self.table_insert_row(False)),
                ("Insert row below", lambda: self.table_insert_row(True)),
                ("Insert column left", lambda: self.table_insert_col(False)),
                ("Insert column right", lambda: self.table_insert_col(True)),
                ("Delete row", self.table_delete_row),
                ("Delete column", self.table_delete_col),
                ("Merge selected cells", self.table_merge),
                ("Cell background colour…", self.cellColorRequested.emit),
                ("Delete table", self.table_delete),
            ):
                act = QAction(text, menu)
                act.triggered.connect(fn)
                menu.addAction(act)
            split = QAction("Unmerge cell" if self.cell_is_merged() else "Split cell…", menu)
            split.triggered.connect(self.splitCellRequested.emit)
            menu.addAction(split)
        menu.exec(e.globalPos())

    splitCellRequested = Signal()
    cellColorRequested = Signal()
