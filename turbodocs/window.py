import datetime
import json
import os
from pathlib import Path

from PySide6.QtCore import QEvent, QSettings, Qt, QTimer, Signal
from PySide6.QtGui import (QAction, QActionGroup, QColor, QFont, QIcon, QImage, QKeySequence, QPainter, QPixmap,
                           QTextBlockFormat, QTextCharFormat, QTextCursor, QTextDocumentFragment)
from PySide6.QtWidgets import (QApplication, QComboBox, QFileDialog, QFontComboBox, QHBoxLayout, QInputDialog, QLabel, QMainWindow,
                               QMenu, QMenuBar, QMessageBox, QPlainTextEdit, QSizePolicy, QSlider, QStackedLayout, QToolBar,
                               QToolButton, QVBoxLayout, QWidget)

from . import backup, docx_io, markdown, styles, theme
from .dialogs import LinkDialog, SplitCellDialog, TableDialog, WordCountDialog, text_stats
from .dashboard import Dashboard
from .document import new_document, reset_blank
from .editor import HL_COLORS, IMAGE_EXT, Editor
from .findbar import FindBar
from .popups import ColorPopup, EmojiPopup, LayoutPopup, SplitColorButton
from .prefs import prefs
from .prefs_dialog import PrefsDialog
from .tabs_panel import TabsPanel
from .titlebar import TopBar, cursor_for, edges_at

APP = "TurboDocs"
SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]
FILTER = "Documents (*.docx *.md *.markdown *.txt);;Word documents (*.docx);;Markdown (*.md *.markdown);;Plain text (*.txt)"
MD_EXT = (".md", ".markdown")
LINE_CHOICES = [("Single", 1.0), ("1.15", 1.15), ("1.5", 1.5), ("Double", 2.0)]


class Tab:
    def __init__(self, title, doc):
        self.title, self.doc = title, doc


ZOOM_MIN, ZOOM_MAX = 25, 400


class MdEdit(QPlainTextEdit):
    zoomWheel = Signal(int)

    def wheelEvent(self, e):
        if e.modifiers() & Qt.KeyboardModifier.ControlModifier:
            dy = e.angleDelta().y() or e.pixelDelta().y()
            if dy:
                self.zoomWheel.emit(dy)
            e.accept()
            return
        super().wheelEvent(e)


class Canvas(QWidget):
    resized = Signal()

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self.resized.emit()


def swatch(color, size=14):
    pm = QPixmap(size, size)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setBrush(QColor(color))
    p.setPen(QColor(0, 0, 0, 60))
    p.drawRoundedRect(1, 1, size - 2, size - 2, 3, 3)
    p.end()
    return QIcon(pm)


def letter_icon(color, size=16):
    """A bold 'A' over a colour bar, like the text-colour button in Google Docs."""
    pm = QPixmap(size, size)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    f = QFont()
    f.setBold(True)
    f.setPixelSize(size - 5)
    p.setFont(f)
    p.setPen(QColor(theme.cur["text"]))
    p.drawText(pm.rect().adjusted(0, -2, 0, 0), Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop, "A")
    p.fillRect(1, size - 4, size - 2, 3, QColor(color))
    p.end()
    return QIcon(pm)


class MainWindow(QMainWindow):
    def __init__(self, open_path=None):
        super().__init__()
        self.settings = QSettings(APP, APP)
        self.path = None
        self.md_path = None
        self.md_mode = False
        self.md_native = False
        self.struct_dirty = False
        self._custom = False
        self._menus = []
        self.backup = backup.Backup()
        self.styles = styles.DocStyles()
        self.tabs: list[Tab] = []
        self.cur = 0

        self.editor = Editor()
        self.md = MdEdit()
        self.md.setObjectName("MdView")
        self.md_highlighter = markdown.MdHighlighter(self.md.document())
        self.canvas = Canvas()
        self.stack = QStackedLayout()
        rich = QWidget()
        rl = QVBoxLayout(rich)
        rl.setContentsMargins(0, 0, 0, 0)
        rl.addWidget(self.editor)
        mdpage = QWidget()
        ml = QVBoxLayout(mdpage)
        ml.setContentsMargins(0, 0, 0, 0)
        ml.setSpacing(0)
        self.banner = QLabel("Markdown view — a separate text rendering of this document. Ctrl+S saves a .md file; "
                             "your .docx is not changed.")
        self.banner.setObjectName("Banner")
        self.banner.setWordWrap(True)
        ml.addWidget(self.banner)
        ml.addWidget(self.md, 1)
        self.dashboard = Dashboard()
        self.stack.addWidget(rich)
        self.stack.addWidget(mdpage)
        self.stack.addWidget(self.dashboard)
        self.home = False
        self._hl_user = False
        self.canvas.setLayout(self.stack)
        self.setCentralWidget(self.canvas)

        self.panel = TabsPanel(self.canvas)
        self.findbar = FindBar(self.canvas, lambda: self.editor)
        self.resize(1240, 820)

        self._build_actions()
        self._build_menus()
        self._build_toolbar()
        self._build_status()
        self._wire_panel()
        self.dashboard.newRequested.connect(self.new_from_dashboard)
        self.dashboard.newMdRequested.connect(self.new_markdown)
        self.dashboard.openRequested.connect(self.open_dialog)
        self.dashboard.openPath.connect(lambda p: self.maybe_save() and self.open_path(p, checked=True))
        self.dashboard.clearRequested.connect(lambda: (prefs.clear_recent(), self.dashboard.refresh([])))

        self._backup_timer = QTimer(self, singleShot=True)
        self._backup_timer.timeout.connect(self._write_backup)
        self._count_timer = QTimer(self, singleShot=True, interval=300)
        self._count_timer.timeout.connect(self._update_count)
        self._outline_timer = QTimer(self, singleShot=True, interval=400)
        self._outline_timer.timeout.connect(self._update_outline)

        self.editor.set_layout(prefs.get("text_width"), prefs.get("margin_left"), prefs.get("margin_right"))
        self.editor.currentCharFormatChanged.connect(lambda *_: self._sync_toolbar())
        self.editor.cursorPositionChanged.connect(self._sync_toolbar)
        self.editor.selectionChanged.connect(self._update_count)
        self.editor.undoAvailable.connect(self.a_undo.setEnabled)
        self.editor.redoAvailable.connect(self.a_redo.setEnabled)
        self.editor.splitCellRequested.connect(self.split_cell)
        self.editor.cellColorRequested.connect(lambda: self._pick('cell'))
        self.md.document().modificationChanged.connect(self._update_title)
        self.canvas.resized.connect(self._place_overlays)
        prefs.changed.connect(self._apply_prefs)

        self._install(styles.DocStyles(), [("Tab 1", None)])
        self.set_zoom_pct(prefs.get("zoom"), save=False)
        self._apply_prefs()
        if prefs.get("tabs_open"):
            self.a_tabs.setChecked(True)
        QTimer.singleShot(0, lambda: self._startup(open_path))

    # ============================================================ actions & menus
    def _act(self, text, slot=None, shortcut=None, checkable=False, tip=None):
        a = QAction(text, self)
        a.setCheckable(checkable)
        if shortcut:
            a.setShortcuts(shortcut if isinstance(shortcut, list) else [shortcut])
        if slot:
            (a.toggled if checkable else a.triggered).connect(slot)
        if tip:
            a.setToolTip(tip)
        self.addAction(a)
        return a

    def _build_actions(self):
        S, A = QKeySequence.StandardKey, self._act
        ed = self.editor
        self.a_home = A("Dashboard", self.show_dashboard, "Ctrl+Alt+H")
        self.a_new = A("New document", self.new_doc, S.New)
        self.a_new_md = A("New Markdown document", self.new_markdown, "Ctrl+Alt+N")
        self.a_open = A("Open…", self.open_dialog, S.Open)
        self.a_save = A("Save", self.save, S.Save)
        self.a_saveas = A("Save as…", self.save_as, S.SaveAs)
        self.a_reset = A("Reset all session edits…", self.reset_session)
        self.a_prefs = A("Preferences…", self.show_prefs, "Ctrl+,")
        self.a_quit = A("Quit", self.close, S.Quit)

        self.a_undo = A("Undo", ed.undo, S.Undo)
        self.a_redo = A("Redo", ed.redo, [QKeySequence("Ctrl+Shift+Z"), QKeySequence("Ctrl+Y")])
        self.a_undo.setEnabled(False)
        self.a_redo.setEnabled(False)
        self.a_cut, self.a_copy = A("Cut", ed.cut, S.Cut), A("Copy", ed.copy, S.Copy)
        self.a_paste = A("Paste", ed.paste, S.Paste)
        self.a_paste_plain = A("Paste without formatting", ed.paste_plain, "Ctrl+Shift+V")
        self.a_all = A("Select all", ed.selectAll, S.SelectAll)
        self.a_find = A("Find…", lambda: self.open_find(False), "Ctrl+F")
        self.a_replace = A("Find and replace…", lambda: self.open_find(True), "Ctrl+H")
        self.a_wc = A("Word count…", self.show_word_count, "Ctrl+Shift+C")

        self.a_md = A("Markdown view", self.toggle_md, "Ctrl+Alt+M", True)
        self.a_tabs = A("Document tabs", lambda on: self.panel.set_expanded(on), "Ctrl+Alt+T", True)
        self.a_width = A("Text width and margins…", lambda: self._show_layout(), "Ctrl+Alt+W")
        self.a_full = A("Full screen", self.toggle_fullscreen, "F11", True)
        self.a_zoom_in = A("Zoom in", lambda: self.step_zoom(10), [QKeySequence("Ctrl++"), QKeySequence("Ctrl+=")])
        self.a_zoom_out = A("Zoom out", lambda: self.step_zoom(-10), "Ctrl+-")
        self.a_zoom_reset = A("Actual size (100%)", lambda: self.set_zoom_pct(100), "Ctrl+0")

        self.a_image = A("Image…", self.insert_image_dialog)
        self.a_table = A("Table…", self.insert_table_dialog)
        self.a_emoji = A("Emoji…", lambda: self._show_emoji(), "Ctrl+;")
        self.a_link = A("Link…", self.insert_link, "Ctrl+K")
        self.a_date = A("Today's date", lambda: ed.insertPlainText(datetime.date.today().strftime("%B %-d, %Y")))

        self.a_bold = A("Bold", lambda on: self._fmt(bold=on), "Ctrl+B", True)
        self.a_italic = A("Italic", lambda on: self._fmt(italic=on), "Ctrl+I", True)
        self.a_underline = A("Underline", lambda on: self._fmt(underline=on), "Ctrl+U", True)
        self.a_strike = A("Strikethrough", lambda on: self._fmt(strike=on), "Ctrl+Shift+X", True)
        self.a_clear = A("Clear formatting", ed.clear_formatting, "Ctrl+\\")
        self.a_size_up = A("Increase font size", lambda: ed.step_font_size(1), "Ctrl+Shift+>")
        self.a_size_down = A("Decrease font size", lambda: ed.step_font_size(-1), "Ctrl+Shift+<")

        self.aligns = {}
        grp = QActionGroup(self)
        for name, flag, sc in (("Align left", Qt.AlignmentFlag.AlignLeft, "Ctrl+Shift+L"),
                               ("Align center", Qt.AlignmentFlag.AlignHCenter, "Ctrl+Shift+E"),
                               ("Align right", Qt.AlignmentFlag.AlignRight, "Ctrl+Shift+R"),
                               ("Justify", Qt.AlignmentFlag.AlignJustify, "Ctrl+Shift+J")):
            a = A(name, lambda on, f=flag: on and ed.setAlignment(f), sc, True)
            grp.addAction(a)
            self.aligns[flag] = a
        self.a_indent = A("Increase indent", lambda: ed.change_indent(1), "Ctrl+]")
        self.a_outdent = A("Decrease indent", lambda: ed.change_indent(-1), "Ctrl+[")
        self.a_bullets = A("Bulleted list", lambda: self._toggle_list("Bulleted list"), "Ctrl+Shift+8", True)
        self.a_numbers = A("Numbered list", lambda: self._toggle_list("Numbered list"), "Ctrl+Shift+7", True)

        self.style_actions = {}
        for i, key in enumerate(("Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3")):
            sc = {"Normal": "Ctrl+Alt+0", "Heading 1": "Ctrl+Alt+1", "Heading 2": "Ctrl+Alt+2",
                  "Heading 3": "Ctrl+Alt+3"}.get(key)
            label = "Normal text" if key == "Normal" else key
            self.style_actions[key] = A(label, lambda _=False, k=key: self.apply_style(k), sc)
        self.a_update_style = A("Update style to match selection", self.update_style)
        self.a_reset_styles = A("Reset styles to defaults…", self.reset_styles)
        self.a_save_styles = A("Use these styles as my default", self.save_styles_as_default)

        self.a_crop = A("Crop image", ed.start_crop)
        self.a_img_reset = A("Reset image", ed.reset_image)
        self.a_img_orig = A("Original image size", ed.original_image_size)
        self.a_row_above = A("Insert row above", lambda: ed.table_insert_row(False))
        self.a_row_below = A("Insert row below", lambda: ed.table_insert_row(True))
        self.a_col_left = A("Insert column left", lambda: ed.table_insert_col(False))
        self.a_col_right = A("Insert column right", lambda: ed.table_insert_col(True))
        self.a_del_row = A("Delete row", ed.table_delete_row)
        self.a_del_col = A("Delete column", ed.table_delete_col)
        self.a_del_table = A("Delete table", ed.table_delete)
        self.a_merge = A("Merge selected cells", ed.table_merge)
        self.a_split = A("Split cell…", self.split_cell)

        self.line_actions = []
        lg = QActionGroup(self)
        for label, val in LINE_CHOICES:
            a = A(f"Line spacing: {label}", lambda on, v=val: on and ed.set_line_spacing(v), None, True)
            a.setData(val)
            lg.addAction(a)
            self.line_actions.append(a)
        self.a_line_custom = A("Custom line spacing…", self.custom_line_spacing)
        self.a_space_before = A("Add space before paragraph", lambda: ed.set_paragraph_space(before=12))
        self.a_space_after = A("Add space after paragraph", lambda: ed.set_paragraph_space(after=12))
        self.a_space_none = A("Remove paragraph spacing", lambda: ed.set_paragraph_space(before=0, after=0))

        self.a_text_color = A("Text colour…", lambda: self._pick("text"))
        self.a_hl_color = A("Highlight colour…", lambda: self._pick("highlight"))
        self.a_page_color = A("Page colour…", lambda: self._pick("page"))
        self.a_cell_color = A("Cell background colour…", lambda: self._pick("cell"))
        self.hl_color = HL_COLORS[0][1]
        self.text_color = "#e06666"

        # everything that edits the rich document is disabled in Markdown view
        self.rich_actions = [self.a_undo, self.a_redo, self.a_cut, self.a_paste, self.a_paste_plain, self.a_find,
                             self.a_replace, self.a_image, self.a_table, self.a_emoji, self.a_link, self.a_date,
                             self.a_bold, self.a_italic, self.a_underline, self.a_strike, self.a_clear,
                             self.a_size_up, self.a_size_down, self.a_indent, self.a_outdent, self.a_bullets,
                             self.a_numbers, self.a_crop, self.a_img_reset, self.a_img_orig, self.a_update_style,
                             self.a_reset_styles, self.a_split, self.a_merge, self.a_row_above, self.a_row_below,
                             self.a_col_left, self.a_col_right, self.a_del_row, self.a_del_col, self.a_del_table,
                             self.a_text_color, self.a_hl_color, self.a_page_color, self.a_cell_color,
                             self.a_line_custom, self.a_space_before, self.a_space_after, self.a_space_none,
                             *self.aligns.values(), *self.line_actions, *self.style_actions.values()]

    def _menu(self, parent, title):
        """A menu parented to its bar/menu and referenced from self (PySide's addMenu(str) wrapper can be
        garbage-collected together with the C++ menu)."""
        menu = QMenu(title, parent)
        parent.addMenu(menu)
        self._menus.append(menu)
        return menu

    def _build_menus(self):
        mb = self.menubar = QMenuBar()   # kept on self: a local would let Python free the bar (and its menus)
        self.topbar = TopBar(self, mb)
        self.setMenuWidget(self.topbar)
        self.windowTitleChanged.connect(self.topbar.set_title)
        self.topbar.set_icon(QApplication.windowIcon())
        m = self._menu(mb, "&File")
        m.addActions([self.a_home, self.a_new, self.a_new_md, self.a_open])
        self.recent_menu = self._menu(m, "Open recent")
        self.recent_menu.aboutToShow.connect(self._fill_recent)
        m.addSeparator()
        m.addActions([self.a_save, self.a_saveas])
        m.addSeparator()
        m.addAction(self.a_reset)
        m.addSeparator()
        m.addAction(self.a_prefs)
        m.addAction(self.a_quit)

        m = self._menu(mb, "&Edit")
        m.addActions([self.a_undo, self.a_redo])
        m.addSeparator()
        m.addActions([self.a_cut, self.a_copy, self.a_paste, self.a_paste_plain])
        m.addSeparator()
        m.addAction(self.a_all)
        m.addSeparator()
        m.addActions([self.a_find, self.a_replace])

        m = self._menu(mb, "&View")
        m.addActions([self.a_md, self.a_tabs, self.a_width])
        m.addSeparator()
        m.addActions([self.a_zoom_in, self.a_zoom_out, self.a_zoom_reset])
        m.addSeparator()
        m.addAction(self.a_full)

        m = self._menu(mb, "&Insert")
        m.addActions([self.a_image, self.a_table, self.a_link, self.a_emoji, self.a_date])

        self.format_menu = m = self._menu(mb, "F&ormat")
        t = self._menu(m, "Text")
        t.addActions([self.a_bold, self.a_italic, self.a_underline, self.a_strike])
        t.addSeparator()
        t.addActions([self.a_text_color, self.a_hl_color])
        t.addActions([self.a_size_up, self.a_size_down])
        t.addSeparator()
        t.addAction(self.a_clear)
        ps = self._menu(m, "Paragraph styles")
        ps.addActions(list(self.style_actions.values()))
        ps.addSeparator()
        ps.addActions([self.a_update_style, self.a_reset_styles, self.a_save_styles])
        al = self._menu(m, "Align and indent")
        al.addActions(list(self.aligns.values()))
        al.addSeparator()
        al.addActions([self.a_indent, self.a_outdent])
        ls = self._menu(m, "Line and paragraph spacing")
        ls.addActions(self.line_actions)
        ls.addAction(self.a_line_custom)
        ls.addSeparator()
        ls.addActions([self.a_space_before, self.a_space_after, self.a_space_none])
        ls.aboutToShow.connect(self._sync_line_actions)
        self.line_menu = ls
        m.addActions([self.a_bullets, self.a_numbers])
        m.addSeparator()
        m.addAction(self.a_page_color)
        im = self._menu(m, "Image")
        im.addActions([self.a_crop, self.a_img_reset, self.a_img_orig])
        tb = self._menu(m, "Table")
        tb.addActions([self.a_row_above, self.a_row_below, self.a_col_left, self.a_col_right])
        tb.addSeparator()
        tb.addActions([self.a_merge, self.a_split, self.a_cell_color])
        tb.addSeparator()
        tb.addActions([self.a_del_row, self.a_del_col, self.a_del_table])
        self.rich_menus = [m, self._menus[next(i for i, x in enumerate(self._menus) if x.title() == '&Insert')]]  # Format, Insert

        m = self._menu(mb, "&Tools")
        m.addActions([self.a_wc, self.a_prefs])

    def _quick(self, action, glyph, tip, bold=False, italic=False, underline=False):
        b = QToolButton()
        b.setText(glyph)
        keys = action.shortcut().toString(QKeySequence.SequenceFormat.NativeText)
        b.setToolTip(f"{tip} ({keys})" if keys else tip)
        b.setCheckable(action.isCheckable())
        f = b.font()
        f.setBold(bold)
        f.setItalic(italic)
        f.setUnderline(underline)
        b.setFont(f)
        b.setMinimumWidth(30)
        b.setEnabled(action.isEnabled())
        b.clicked.connect(action.trigger)
        if action.isCheckable():
            action.toggled.connect(b.setChecked)
        action.changed.connect(lambda: b.setEnabled(action.isEnabled()))
        self.toolbar.addWidget(b)
        return b

    def _build_toolbar(self):
        tb = self.toolbar = QToolBar("Format")
        tb.setMovable(False)
        tb.setFloatable(False)
        self.addToolBar(tb)
        self._quick(self.a_undo, "↶", "Undo")
        self._quick(self.a_redo, "↷", "Redo")
        tb.addSeparator()
        self.style_box = QComboBox()
        self.style_box.addItems([("Normal text" if k == "Normal" else k) for k in styles.ORDER])
        self.style_box.setMinimumWidth(118)
        self.style_box.setToolTip("Paragraph style")
        self.style_box.activated.connect(lambda i: (self.apply_style(styles.ORDER[i]), self.editor.setFocus()))
        self.font_box = QFontComboBox()
        self.font_box.setMinimumWidth(150)
        self.font_box.setToolTip("Font")
        self.font_box.activated.connect(lambda _: self._fmt(family=self.font_box.currentFont().family()))
        self.size_box = QComboBox()
        self.size_box.setEditable(True)
        self.size_box.addItems([f"{s:g}" for s in SIZES])
        self.size_box.setFixedWidth(72)
        self.size_box.setToolTip("Font size")
        self.size_box.activated.connect(lambda _: self._set_size())
        self.size_box.lineEdit().editingFinished.connect(self._set_size)
        for w in (self.style_box, self.font_box, self.size_box):
            tb.addWidget(w)
        tb.addSeparator()
        self._quick(self.a_bold, "B", "Bold", bold=True)
        self._quick(self.a_italic, "I", "Italic", italic=True)
        self._quick(self.a_underline, "U", "Underline", underline=True)
        self.tc_btn = SplitColorButton("Text colour")
        self.tc_btn.apply.connect(lambda: self._text_color(self.text_color))
        self.tc_btn.openPicker.connect(lambda: self._pick("text"))
        self.hl_btn = SplitColorButton("Highlight colour")
        self.hl_btn.apply.connect(lambda: self._highlight(self.hl_color))
        self.hl_btn.openPicker.connect(lambda: self._pick("highlight"))
        tb.addWidget(self.tc_btn)
        tb.addWidget(self.hl_btn)
        self._paint_color_buttons()
        tb.addSeparator()
        for flag, glyph in ((Qt.AlignmentFlag.AlignLeft, "⯇"), (Qt.AlignmentFlag.AlignHCenter, "≡"),
                            (Qt.AlignmentFlag.AlignRight, "⯈"), (Qt.AlignmentFlag.AlignJustify, "☰")):
            a = self.aligns[flag]
            self._quick(a, glyph, a.text())
        ls = QToolButton()
        ls.setText("↕")
        ls.setToolTip("Line and paragraph spacing")
        ls.setMenu(self.line_menu)
        ls.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        tb.addWidget(ls)
        tb.addSeparator()
        self._quick(self.a_bullets, "•", "Bulleted list")
        self._quick(self.a_numbers, "1.", "Numbered list")
        self._quick(self.a_outdent, "⇤", "Decrease indent")
        self._quick(self.a_indent, "⇥", "Increase indent")
        tb.addSeparator()
        self._quick(self.a_link, "🔗", "Insert link")
        self._quick(self.a_image, "🖼", "Insert image")
        self._quick(self.a_table, "▦", "Insert table")
        self.emoji_btn = self._quick(self.a_emoji, "😀", "Insert emoji")
        sp = QWidget()
        sp.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        tb.addWidget(sp)
        self.layout_btn = QToolButton()
        self.layout_btn.setText("↔  Width")
        self.layout_btn.setToolTip("Text width and margins (Ctrl+Alt+W)")
        self.layout_btn.clicked.connect(lambda: self._show_layout())
        tb.addWidget(self.layout_btn)

    def _build_status(self):
        self.count_label = QLabel()
        self.statusBar().addPermanentWidget(self.count_label)
        self.statusBar().setSizeGripEnabled(False)
        self.zoom_box = QWidget()
        self.zoom_box.setObjectName("ZoomBox")
        zl = QHBoxLayout(self.zoom_box)
        zl.setContentsMargins(0, 0, 8, 0)
        zl.setSpacing(2)
        self.zoom_label = QToolButton()
        self.zoom_label.setObjectName("ZoomLabel")
        self.zoom_label.setToolTip("Reset zoom to 100% (Ctrl+0)")
        self.zoom_label.setMinimumWidth(48)
        self.zoom_label.clicked.connect(lambda: self.set_zoom_pct(100))
        minus, plus = QToolButton(), QToolButton()
        for b, glyph, tip, d in ((minus, "−", "Zoom out (Ctrl+−)", -10), (plus, "+", "Zoom in (Ctrl++)", 10)):
            b.setText(glyph)
            b.setObjectName("ZoomStep")
            b.setToolTip(tip)
            b.setAutoRepeat(True)
            b.clicked.connect(lambda _=False, d=d: self.step_zoom(d))
        self.zoom_slider = QSlider(Qt.Orientation.Horizontal)
        self.zoom_slider.setRange(ZOOM_MIN, ZOOM_MAX)
        self.zoom_slider.setFixedWidth(110)
        self.zoom_slider.setToolTip("Zoom")
        self.zoom_slider.valueChanged.connect(lambda v: self.set_zoom_pct(v))
        for w in (minus, self.zoom_slider, plus, self.zoom_label):
            zl.addWidget(w)
        self.statusBar().addPermanentWidget(self.zoom_box)
        self.zoom_pct = 100
        self.editor.zoomWheel.connect(self._wheel_zoom)
        self.md.zoomWheel.connect(self._wheel_zoom)

    # ---- zoom (editor + Markdown view)
    def _wheel_zoom(self, delta):
        self.step_zoom(round(delta / 120 * 10) or (10 if delta > 0 else -10))

    def step_zoom(self, d):
        self.set_zoom_pct(self.zoom_pct + d)

    def set_zoom_pct(self, pct, save=True):
        pct = max(ZOOM_MIN, min(ZOOM_MAX, int(pct)))
        self.zoom_pct = pct
        self.editor.set_zoom(pct / 100)
        self.md.setStyleSheet(f"#MdView {{ font-size: {11 * pct / 100:.1f}pt; }}" if pct != 100 else "")
        self.zoom_label.setText(f"{pct}%")
        self.zoom_slider.blockSignals(True)
        self.zoom_slider.setValue(pct)
        self.zoom_slider.blockSignals(False)
        if save:
            prefs.set("zoom", pct, False)

    def _wire_panel(self):
        p = self.panel
        p.tabSelected.connect(self.switch_tab)
        p.addRequested.connect(self.add_tab)
        p.renamed.connect(self.rename_tab)
        p.deleteRequested.connect(self.delete_tab)
        p.duplicateRequested.connect(self.duplicate_tab)
        p.reordered.connect(self.reorder_tabs)
        p.outlineClicked.connect(self.goto_pos)
        p.toggled.connect(lambda on: (self.a_tabs.blockSignals(True), self.a_tabs.setChecked(on),
                                      self.a_tabs.blockSignals(False), prefs.set("tabs_open", on, False)))

    def showEvent(self, e):
        super().showEvent(e)
        self._place_overlays()

    def _place_overlays(self):
        self.panel.move(14, 14)
        self.panel.fit_height(self.canvas.height())
        self.findbar.adjustSize()
        self.findbar.move(max(8, self.canvas.width() - self.findbar.width() - 28), 12)
        self.panel.raise_()
        self.findbar.raise_()

    # ============================================================ tabs / documents
    def _install(self, st, tab_specs, idx=0):
        """tab_specs: [(title, QTextDocument | None)]"""
        self.styles = st
        self.tabs = []
        for title, doc in tab_specs:
            if doc is None:
                doc = new_document(st, title)
                reset_blank(doc)
            doc.modificationChanged.connect(self._update_title)
            doc.contentsChanged.connect(self._on_contents)
            self.tabs.append(Tab(title, doc))
        self.struct_dirty = False
        self.cur = -1
        self.switch_tab(min(idx, len(self.tabs) - 1))
        if len(self.tabs) > 1 and not self.panel.expanded:
            self.panel.set_expanded(True)  # the document has tabs: show them
        self._update_title()
        self._place_overlays()

    def switch_tab(self, i):
        if i == self.cur or not (0 <= i < len(self.tabs)):
            return
        self.cur = i
        doc = self.tabs[i].doc
        self.editor.set_document(doc)
        self.editor.set_page_color(self.styles.page_color)
        self.a_undo.setEnabled(doc.isUndoAvailable())
        self.a_redo.setEnabled(doc.isRedoAvailable())
        self.panel.set_tabs([t.title for t in self.tabs], i)
        self._update_outline()
        self._update_count()
        self._sync_toolbar()
        self.findbar.refresh()

    def _tab_list(self):
        return [(t.title, t.doc) for t in self.tabs]

    def _mark_struct(self):
        self.struct_dirty = True
        self._update_title()
        self._schedule()

    def add_tab(self):
        n = len(self.tabs) + 1
        titles = {t.title for t in self.tabs}
        while f"Tab {n}" in titles:
            n += 1
        doc = new_document(self.styles, f"Tab {n}")
        reset_blank(doc)
        self._attach(doc)
        self.tabs.append(Tab(f"Tab {n}", doc))
        self._mark_struct()
        self.cur = -1
        self.switch_tab(len(self.tabs) - 1)

    def _attach(self, doc):
        doc.modificationChanged.connect(self._update_title)
        doc.contentsChanged.connect(self._on_contents)

    def rename_tab(self, i, title):
        if 0 <= i < len(self.tabs) and self.tabs[i].title != title:
            self.tabs[i].title = title
            self._mark_struct()

    def delete_tab(self, i):
        if len(self.tabs) == 1:
            QMessageBox.information(self, APP, "A document needs at least one tab.")
            return
        if QMessageBox.question(self, APP, f"Delete “{self.tabs[i].title}”? This can't be undone.") != \
                QMessageBox.StandardButton.Yes:
            return
        del self.tabs[i]
        self._mark_struct()
        self.cur = -1
        self.switch_tab(max(0, i - 1))

    def duplicate_tab(self, i):
        src = self.tabs[i]
        doc = new_document(self.styles, src.title + " copy")
        QTextCursor(doc).insertFragment(QTextDocumentFragment(src.doc))
        doc.clearUndoRedoStacks()
        self._attach(doc)
        self.tabs.insert(i + 1, Tab(src.title + " copy", doc))
        self._mark_struct()
        self.cur = -1
        self.switch_tab(i + 1)

    def reorder_tabs(self, order):
        current = self.tabs[self.cur]
        self.tabs = [self.tabs[i] for i in order]
        self.cur = self.tabs.index(current)
        self.panel.set_tabs([t.title for t in self.tabs], self.cur)
        self._mark_struct()

    def goto_pos(self, pos):
        c = QTextCursor(self.editor.document())
        c.setPosition(pos)
        self.editor.setTextCursor(c)
        rect = self.editor.cursorRect(c)
        bar = self.editor.verticalScrollBar()
        bar.setValue(bar.value() + rect.top() - 40)
        self.editor.setFocus()

    def _update_outline(self):
        doc, out, b = self.editor.document(), [], self.editor.document().begin()
        while b.isValid():
            key = styles.key_of_block(b)
            if key in ("Title", "Heading 1", "Heading 2", "Heading 3") and b.text().strip():
                out.append((0 if key == "Title" else int(key[-1]), b.text().strip(), b.position()))
            b = b.next()
        self.panel.set_outline(out)

    # ============================================================ formatting glue
    def _fmt(self, bold=None, italic=None, underline=None, strike=None, family=None, size=None):
        f = QTextCharFormat()
        if bold is not None:
            f.setFontWeight(QFont.Weight.Bold if bold else QFont.Weight.Normal)
        if italic is not None:
            f.setFontItalic(italic)
        if underline is not None:
            f.setFontUnderline(underline)
        if strike is not None:
            f.setFontStrikeOut(strike)
        if family:
            f.setFontFamilies([family])
        if size:
            f.setFontPointSize(size)
        self.editor.mergeCurrentCharFormat(f)
        self.editor.setFocus()

    def _set_size(self):
        try:
            size = float(self.size_box.currentText().replace(",", "."))
        except ValueError:
            return
        if 1 <= size <= 400:
            self._fmt(size=size)

    def _paint_color_buttons(self):
        self.hl_btn.setIcon(swatch(self.hl_color, 16))
        self.tc_btn.setIcon(letter_icon(self.text_color))

    def _highlight(self, color):
        if color:
            self.hl_color = color
            self._hl_user = True
            self._paint_color_buttons()
        self.editor.set_highlight(color)
        self.editor.setFocus()

    def _pick(self, kind):
        """Open the colour popup for text / highlight / page / table-cell colour."""
        labels = {"text": "Automatic", "highlight": "No highlight", "page": "Default page colour",
                  "cell": "No cell colour"}
        anchor = {"text": self.tc_btn, "highlight": self.hl_btn}.get(kind, self.layout_btn)
        handler = {"text": self._text_color, "highlight": self._highlight, "page": self._page_color,
                   "cell": self._cell_color}[kind]
        self._color_popup = ColorPopup(self, labels[kind])
        self._color_popup.chosen.connect(handler)
        self._color_popup.show_below(anchor)

    def _page_color(self, color):
        self.styles.page_color = color
        self.editor.set_page_color(color)
        self._mark_struct()

    def _cell_color(self, color):
        self.editor.set_cell_color(color)
        self.editor.setFocus()

    def _text_color(self, color):
        if color:
            self.text_color = color
            self._paint_color_buttons()
        self.editor.set_text_color(color)
        self.editor.setFocus()

    def apply_style(self, key):
        self.editor.apply_style(key)
        self.editor.setFocus()

    def _toggle_list(self, key):
        self.editor.apply_style("Normal" if self.editor.current_style() == key else key)
        self.editor.setFocus()

    def custom_line_spacing(self):
        v, ok = QInputDialog.getDouble(self, "Line spacing", "Line spacing (multiple of single):",
                                       self.editor.current_line_spacing(), 0.8, 5.0, 2)
        if ok:
            self.editor.set_line_spacing(v)

    def _sync_line_actions(self):
        cur = self.editor.current_line_spacing()
        for a in self.line_actions:
            a.blockSignals(True)
            a.setChecked(abs(a.data() - cur) < 0.06)
            a.blockSignals(False)

    def _sync_toolbar(self):
        if not self.tabs or self.cur < 0:
            return
        ed = self.editor
        fmt = ed.currentCharFormat()
        for a, v in ((self.a_bold, fmt.fontWeight() >= QFont.Weight.DemiBold), (self.a_italic, fmt.fontItalic()),
                     (self.a_underline, fmt.fontUnderline()), (self.a_strike, fmt.fontStrikeOut())):
            a.blockSignals(True)
            a.setChecked(v)
            a.blockSignals(False)
            a.toggled.emit(v) if False else None
        # mirror to quickbar buttons (their action.toggled hook is silenced above)
        for a in (self.a_bold, self.a_italic, self.a_underline):
            for b in self.toolbar.findChildren(QToolButton):
                if b.isCheckable() and b.text() == {"Bold": "B", "Italic": "I", "Underline": "U"}[a.text()]:
                    b.setChecked(a.isChecked())
        base = ed.document().defaultFont()
        fams = fmt.property(fmt.Property.FontFamilies) if fmt.hasProperty(fmt.Property.FontFamilies) else None
        family = fams[0] if fams else base.family()
        size = fmt.fontPointSize() or self.styles.base_size
        key = ed.current_style()
        widgets = (self.font_box, self.size_box, self.style_box)
        for w in widgets:
            w.blockSignals(True)
        self.font_box.setCurrentFont(QFont(family))
        self.size_box.setCurrentText(f"{size:g}")
        self.style_box.setCurrentIndex(styles.ORDER.index(key))
        for w in widgets:
            w.blockSignals(False)
        align = ed.alignment()
        for flag, a in self.aligns.items():
            on = bool(align & flag) if flag != Qt.AlignmentFlag.AlignLeft else not (
                align & (Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignJustify))
            a.blockSignals(True)
            a.setChecked(on)
            a.blockSignals(False)
        self._mirror_checks()

    def _mirror_checks(self):
        key = self.editor.current_style()
        for a, on in ((self.a_bullets, key == "Bulleted list"), (self.a_numbers, key == "Numbered list")):
            a.blockSignals(True)
            a.setChecked(on)
            a.blockSignals(False)
        for b in self.toolbar.findChildren(QToolButton):
            if not b.isCheckable():
                continue
            for a in [self.a_bullets, self.a_numbers, *self.aligns.values()]:
                glyph = {"Bulleted list": "•", "Numbered list": "1.", "Align left": "⯇", "Align center": "≡",
                         "Align right": "⯈", "Justify": "☰"}[a.text()]
                if b.text() == glyph:
                    b.setChecked(a.isChecked())

    # ---- per-document styles
    def update_style(self):
        key = self.editor.current_style()
        if key in styles.LIST_STYLES:
            return
        look, st = self.editor.current_look(), self.styles
        d = st.defs[key]
        if key == "Normal":
            st.base_size = look["size"]
            if look["family"]:
                st.base_family = look["family"]
            for _t, doc in self._tab_list():
                doc.setDefaultFont(st.base_font())
        else:
            d.size, d.bold, d.italic = look["size"], look["bold"], look["italic"]
            d.family = look["family"] if look["family"] != st.base_family else ""
            d.color = look["color"]
        d.before, d.after, d.line = look["before"], look["after"], look["line"]
        self._restyle_all(key)
        self.statusBar().showMessage(f"Updated “{key}” to match the selection (this document only).", 4000)

    def _restyle_all(self, key):
        st = self.styles
        d = st.def_for(key)
        for _t, doc in self._tab_list():
            c = QTextCursor(doc)
            c.beginEditBlock()
            b = doc.begin()
            while b.isValid():
                if styles.key_of_block(b) == key:
                    bf = QTextBlockFormat()
                    bf.setTopMargin(d.before)
                    bf.setBottomMargin(d.after)
                    bf.setLineHeight(d.line * 100, QTextBlockFormat.LineHeightTypes.ProportionalHeight.value)
                    QTextCursor(b).mergeBlockFormat(bf)
                    if st.has_look(key) and b.length() > 1:
                        f = QTextCharFormat()
                        f.setFontWeight(QFont.Weight.Bold if d.bold else QFont.Weight.Normal)
                        f.setFontItalic(d.italic)
                        if d.size:
                            f.setFontPointSize(d.size)
                        if d.family:
                            f.setFontFamilies([d.family])
                        r = QTextCursor(b)
                        r.setPosition(b.position() + b.length() - 1, QTextCursor.MoveMode.KeepAnchor)
                        r.mergeCharFormat(f)
                b = b.next()
            c.endEditBlock()
        self._sync_toolbar()

    def reset_styles(self):
        if QMessageBox.question(self, APP, "Reset every paragraph style in this document to your default styles?") != \
                QMessageBox.StandardButton.Yes:
            return
        st = styles.DocStyles()
        self.styles.defs, self.styles.base_family, self.styles.base_size = st.defs, st.base_family, st.base_size
        for _t, doc in self._tab_list():
            doc.setDefaultFont(self.styles.base_font())
        for key in styles.STYLED:
            self._restyle_all(key)

    def save_styles_as_default(self):
        prefs.set("styles_json", json.dumps(self.styles.to_overrides()), False)
        prefs.set("doc_family", self.styles.base_family, False)
        prefs.set("doc_size", self.styles.base_size, False)
        self.statusBar().showMessage("Saved this document's styles as your defaults for new documents.", 4000)

    # ============================================================ inserts / popups
    def _show_layout(self):
        ed = self.editor
        pop = LayoutPopup(self, ed.text_width, ed.margin_left, ed.margin_right)
        pop.changed.connect(self._layout_changed)
        pop.show_below(self.layout_btn)

    def _layout_changed(self, w, l, r):
        self.editor.set_layout(w, l, r)
        for k, v in (("text_width", w), ("margin_left", l), ("margin_right", r)):
            prefs.set(k, v, False)

    def _show_emoji(self):
        pop = EmojiPopup(self)
        pop.picked.connect(lambda e: (self.editor.insertPlainText(e), self.editor.setFocus()))
        pop.show_below(self.emoji_btn)

    def insert_image_dialog(self):
        exts = " ".join("*" + e for e in IMAGE_EXT)
        path, _ = QFileDialog.getOpenFileName(self, "Insert image", self._start_dir(), f"Images ({exts})")
        if not path:
            return
        img = QImage(path)
        if img.isNull():
            QMessageBox.warning(self, APP, "That image could not be read.")
            return
        ext = path.lower().rsplit(".", 1)[-1]
        blob = Path(path).read_bytes() if ext in ("png", "jpg", "jpeg") else None
        self.editor.insert_image(img, blob, "jpg" if ext == "jpeg" else ext)

    def insert_table_dialog(self):
        d = TableDialog(self)
        if d.exec():
            self.editor.insert_table(d.rows.value(), d.cols.value())

    def insert_link(self):
        cur = self.editor.textCursor()
        d = LinkDialog(self, "", self.editor.link_at_cursor(), cur.hasSelection())
        if d.exec() and d.url.text().strip():
            self.editor.insert_link(d.url.text().strip(), d.text.text().strip())

    def split_cell(self):
        t, _cell = self.editor.table_ctx()
        if t is None:
            return
        if self.editor.cell_is_merged():
            self.editor.table_split(1, 1)
            return
        d = SplitCellDialog(self)
        if d.exec():
            self.editor.table_split(d.cols.value(), d.rows.value())

    # ============================================================ find / counts
    def open_find(self, replace):
        if self.md_mode:
            return
        self._place_overlays()
        self.findbar.open(replace)
        self._place_overlays()

    def _words(self, doc=None):
        return text_stats((doc or self.editor.document()).toPlainText())

    def _update_count(self):
        if self.md_mode:
            n = len(self.md.toPlainText().split())
            self.count_label.setText(f"{n:,} words   ")
            return
        n = self._words()["words"]
        sel = self.editor.textCursor().selectedText()
        extra = f"  ·  selection: {len(sel.split()):,}" if sel.strip() else ""
        self.count_label.setText(f"{n:,} word{'s' if n != 1 else ''}{extra}   ")

    def show_word_count(self):
        scopes = {}
        if self.md_mode:
            scopes["Markdown"] = text_stats(self.md.toPlainText())
        else:
            scopes["This tab"] = self._words()
            if len(self.tabs) > 1:
                total = text_stats(" ".join(t.doc.toPlainText() for t in self.tabs))
                scopes["All tabs"] = total
            sel = self.editor.textCursor().selectedText()
            if sel.strip():
                scopes["Selection"] = text_stats(sel)
        WordCountDialog(self, scopes, prefs.get("show_wordcount"),
                        lambda on: prefs.set("show_wordcount", on)).exec()

    # ============================================================ files
    def _start_dir(self):
        if self.path:
            return str(Path(self.path).parent)
        return prefs.get("default_dir") or str(Path.home())

    def _startup(self, open_path):
        found = backup.orphans()
        if found:
            _t, docx, meta, orig = found[0]
            name = Path(orig).name if orig else "an untitled document"
            ans = QMessageBox.question(
                self, APP, f"TurboDocs closed unexpectedly while editing {name}.\n\nRecover the unsaved version?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Discard, QMessageBox.StandardButton.Yes)
            ok = ans == QMessageBox.StandardButton.Yes and self._load(docx)
            if ok:
                self.path = orig
                self.struct_dirty = True
                for t in self.tabs:
                    t.doc.setModified(True)
                self._update_title()
            for _t, d, m, _o in found:
                d.unlink(missing_ok=True)
                m.unlink(missing_ok=True)
            if ok:
                self.leave_dashboard()
                return
        target = open_path or (prefs.get("last_file") if prefs.get("reopen_last") else "")
        if target and Path(target).exists():
            self.open_path(target)
        else:
            self.show_dashboard()  # nothing to open: land on the dashboard

    def _load(self, path):
        try:
            if str(path).lower().endswith(".docx"):
                st, docs = docx_io.import_docx(path)
                self._install(st, docs)
            else:
                text = Path(path).read_text(encoding="utf-8", errors="replace")
                st = styles.DocStyles()
                doc = new_document(st, "Tab 1")
                reset_blank(doc)
                doc.setUndoRedoEnabled(False)
                QTextCursor(doc).insertText(text)
                doc.setUndoRedoEnabled(True)
                doc.setModified(False)
                self._install(st, [("Tab 1", doc)])
        except Exception as e:
            QMessageBox.critical(self, APP, f"Could not open {Path(path).name}:\n{e}")
            return False
        return True

    def _dirty(self):
        return self.struct_dirty or any(t.doc.isModified() for t in self.tabs)

    def maybe_save(self):
        if self.md_mode and not self._leave_md():
            return False
        if not self._dirty():
            return True
        name = Path(self.path).name if self.path else "Untitled"
        box = QMessageBox.question(
            self, APP, f"Save changes to {name}?",
            QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Save)
        if box == QMessageBox.StandardButton.Save:
            return self._save_docx()
        return box == QMessageBox.StandardButton.Discard

    def _drop_md_view(self):
        """Leave Markdown view without a second 'save changes?' prompt (maybe_save already asked)."""
        if self.md_mode:
            self.md.document().setModified(False)
            self.a_md.setChecked(False)

    def new_markdown(self):
        """A blank Markdown document: starts in Markdown view; Ctrl+S saves a .md file."""
        if not self.maybe_save():
            return
        self._drop_md_view()
        self._install(styles.DocStyles(), [("Tab 1", None)])
        self.path = self.md_path = None
        self.backup.clear()
        self.leave_dashboard()
        self._enter_md("", native=True)

    def _enter_md(self, text, native=False):
        self.md_native = native
        self.banner.setText("Markdown document — Ctrl+S saves a .md file. Turn off Markdown view for a blank rich-text page."
                            if native else
                            "Markdown view — a separate text rendering of this document. Ctrl+S saves a .md file; "
                            "your .docx is not changed.")
        if not self.a_md.isChecked():
            self.a_md.setChecked(True)          # toggle_md renders the (blank) document...
        self.md.setPlainText(text)              # ...then we replace the text
        self.md.document().setModified(False)
        self._update_title()

    def new_doc(self):
        if not self.maybe_save():
            return
        self._drop_md_view()
        self.md_native = False
        self.banner.setText("Markdown view — a separate text rendering of this document. Ctrl+S saves a .md file; "
                            "your .docx is not changed.")
        self._install(styles.DocStyles(), [("Tab 1", None)])
        self.path = None
        self.md_path = None
        self.backup.clear()
        self.leave_dashboard()
        self._update_title()

    def open_dialog(self):
        if not self.maybe_save():
            return
        path, _ = QFileDialog.getOpenFileName(self, "Open", self._start_dir(), FILTER)
        if path:
            self.open_path(path, checked=True)

    def open_path(self, path, checked=False):
        if not checked and not self.maybe_save():
            return
        if str(path).lower().endswith(MD_EXT):
            try:
                text = Path(path).read_text(encoding="utf-8", errors="replace")
            except OSError as e:
                QMessageBox.critical(self, APP, f"Could not open {Path(path).name}:\n{e}")
                return
            self._drop_md_view()
            self._install(styles.DocStyles(), [("Tab 1", None)])
            self.path, self.md_path = None, str(path)
            prefs.add_recent(str(path))
            self.backup.clear()
            self.leave_dashboard()
            self._enter_md(text, native=True)
            return
        self._drop_md_view()
        self.md_native = False
        if self._load(path):
            self.path = str(path)
            self.md_path = None
            prefs.add_recent(self.path)
            prefs.set("last_file", self.path, False)
            self.backup.clear()
            self.leave_dashboard()
            self._update_title()

    def _fill_recent(self):
        m = self.recent_menu
        m.clear()
        items = [p for p in prefs.recent() if Path(p).exists()]
        for p in items:
            m.addAction(Path(p).name, lambda p=p: self.maybe_save() and self.open_path(p, checked=True)).setToolTip(p)
        if not items:
            m.addAction("No recent files").setEnabled(False)
        else:
            m.addSeparator()
            m.addAction("Clear recent", prefs.clear_recent)

    # ---- save (docx, or the separate .md copy while in Markdown view)
    def save(self):
        return self.save_md() if self.md_mode else self._save_docx()

    def save_as(self):
        return self.save_md(force_dialog=True) if self.md_mode else self._save_docx(force_dialog=True)

    def _save_docx(self, force_dialog=False):
        path = self.path
        if not path or force_dialog:
            start = self.path or str(Path(self._start_dir()) / "Untitled.docx")
            path, _ = QFileDialog.getSaveFileName(self, "Save as", start, "Word document (*.docx)")
            if not path:
                return False
            if not path.lower().endswith(".docx"):
                path += ".docx"
        tmp = f"{path}.tmp-{os.getpid()}"
        try:
            docx_io.export_docx(self._tab_list(), self.styles, tmp)
            os.replace(tmp, path)
        except Exception as e:
            Path(tmp).unlink(missing_ok=True)
            QMessageBox.critical(self, APP, f"Could not save:\n{e}")
            return False
        self.path = path
        self.struct_dirty = False
        for t in self.tabs:
            t.doc.setModified(False)
        prefs.add_recent(path)
        prefs.set("last_file", path, False)
        self.backup.clear()
        self._update_title()
        self.statusBar().showMessage(f"Saved {Path(path).name}", 3000)
        return True

    def save_md(self, force_dialog=False):
        path = self.md_path
        if not path or force_dialog:
            base = Path(self.path).with_suffix(".md") if self.path else Path(self._start_dir()) / "Untitled.md"
            path, _ = QFileDialog.getSaveFileName(self, "Save Markdown copy", str(base), "Markdown (*.md)")
            if not path:
                return False
            if not path.lower().endswith(".md"):
                path += ".md"
        try:
            Path(path).write_text(self.md.toPlainText(), encoding="utf-8")
        except OSError as e:
            QMessageBox.critical(self, APP, f"Could not save:\n{e}")
            return False
        self.md_path = path
        self.md.document().setModified(False)
        self._update_title()
        self.statusBar().showMessage(f"Saved {Path(path).name}" + ("" if self.md_native else " — the .docx was not changed."), 5000)
        return True

    def reset_session(self):
        if prefs.get("confirm_reset"):
            what = f"reload {Path(self.path).name} from disk" if self.path else "clear the document"
            if QMessageBox.question(self, APP, f"Discard every edit made this session and {what}?") != \
                    QMessageBox.StandardButton.Yes:
                return
        if self.md_mode:
            self.a_md.setChecked(False)
        if self.path and Path(self.path).exists():
            self._load(self.path)
        else:
            self._install(styles.DocStyles(), [("Tab 1", None)])
        self.backup.clear()
        self._update_title()
        self.statusBar().showMessage("Session edits discarded.", 3000)

    # ============================================================ markdown view
    def toggle_md(self, on):
        if on:
            self.md_mode = True
            self.findbar.hide()
            self.md.setPlainText(markdown.render(self._tab_list()))
            self.md.document().setModified(False)
            self.stack.setCurrentIndex(1)
            self.panel.hide()
            self.md.setFocus()
        else:
            if not self._leave_md():
                self.a_md.blockSignals(True)
                self.a_md.setChecked(True)
                self.a_md.blockSignals(False)
                return
            self.md_mode = False
            self.stack.setCurrentIndex(0)
            self.panel.show()
            self._place_overlays()
            self.editor.setFocus()
        self._lock_ui(on)
        self._update_title()
        self._update_count()

    def _lock_ui(self, locked):
        """Rich-text controls are off while the Markdown view or the dashboard is showing."""
        for a in self.rich_actions:
            a.setEnabled(not locked)
        self.toolbar.setEnabled(not locked)
        for m in self.rich_menus:
            m.menuAction().setEnabled(not locked)

    # ---- dashboard (landing page)
    def show_dashboard(self):
        self.findbar.hide()
        self.dashboard.refresh(prefs.recent())
        self.home = True
        self.stack.setCurrentIndex(2)
        self.panel.hide()
        self._lock_ui(True)
        self.a_md.setEnabled(False)
        self.a_wc.setEnabled(False)
        self._update_title()

    def leave_dashboard(self):
        if not self.home:
            return
        self.home = False
        self.stack.setCurrentIndex(1 if self.md_mode else 0)
        if not self.md_mode:
            self.panel.show()
        self._lock_ui(self.md_mode)
        self.a_md.setEnabled(True)
        self.a_wc.setEnabled(True)
        self._place_overlays()
        self._update_title()
        (self.md if self.md_mode else self.editor).setFocus()

    def new_from_dashboard(self):
        if self._dirty():
            self.new_doc()
        self.leave_dashboard()

    def _leave_md(self):
        if not self.md.document().isModified():
            return True
        box = QMessageBox.question(
            self, APP, "Save the Markdown version before leaving Markdown view?",
            QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Save)
        if box == QMessageBox.StandardButton.Save:
            return self.save_md()
        return box == QMessageBox.StandardButton.Discard

    # ============================================================ preferences & housekeeping
    def show_prefs(self):
        PrefsDialog(self).exec()

    def _apply_prefs(self):
        theme.apply(QApplication.instance(), prefs.get("theme"), prefs.get("accent"), prefs.get("ui_size"),
                    prefs.get("ui_family"), prefs.get("ui_style"))
        self.md_highlighter.rebuild()
        self.editor.apply_prefs()
        self._backup_timer.setInterval(prefs.get("backup_ms"))
        self.count_label.setVisible(prefs.get("show_wordcount"))
        self._set_custom(prefs.get("custom_titlebar"))
        self.zoom_box.setVisible(prefs.get("show_zoom"))
        if not self._hl_user:  # follow the accent (or the colour chosen in Preferences) until the user picks one
            self.hl_color = prefs.get("highlight_color") or theme.cur["accent"]
        self._paint_color_buttons()
        if self.path is None and self.tabs and not self._dirty():  # a fresh document takes the new theme's font
            self.styles.base_family = prefs.get("doc_family") or theme.doc_font_family()
            for t in self.tabs:
                t.doc.setDefaultFont(self.styles.base_font())
        self.editor.viewport().update()

    # ---- custom window decorations
    def _set_custom(self, on):
        if on != self._custom:
            self._custom = on
            was_max, visible = self.isMaximized(), self.isVisible()
            self.setWindowFlag(Qt.WindowType.FramelessWindowHint, on)
            self.setMouseTracking(on)
            if visible:
                self.showMaximized() if was_max else self.show()
        self._fit_frame()

    def _frameless(self):
        return self._custom and not self.isFullScreen()

    def _fit_frame(self):
        tb = theme.fx.get("titlebar")
        if tb is None:
            return
        active = self._frameless()
        self.topbar.configure(active, tb)
        self.topbar.setProperty("custom", "true" if active else "false")
        self.topbar.style().unpolish(self.topbar)
        self.topbar.style().polish(self.topbar)
        self.topbar.set_maximised(self.isMaximized())
        edge = tb["edge"] if active and not self.isMaximized() else 0
        self.setContentsMargins(edge, edge, edge, edge)
        self.update()

    def toggle_maximised(self):
        self.showNormal() if self.isMaximized() else self.showMaximized()

    def _resize_edges(self, pos):
        if not self._frameless() or self.isMaximized():
            return Qt.Edge(0)
        return edges_at(pos, self.size(), max(self.contentsMargins().left(), 4))

    def mouseMoveEvent(self, e):
        edges = self._resize_edges(e.position())
        shape = cursor_for(edges) if edges else None
        self.setCursor(shape) if shape is not None else self.unsetCursor()
        super().mouseMoveEvent(e)

    def mousePressEvent(self, e):
        edges = self._resize_edges(e.position())
        if edges and e.button() == Qt.MouseButton.LeftButton and self.windowHandle() is not None:
            self.windowHandle().startSystemResize(edges)
            return
        super().mousePressEvent(e)

    def leaveEvent(self, e):
        self.unsetCursor()
        super().leaveEvent(e)

    def paintEvent(self, e):
        super().paintEvent(e)
        tb = theme.fx.get("titlebar")
        if not self._frameless() or tb is None:
            return
        p = QPainter(self)
        edge = self.contentsMargins().left()
        if edge:
            p.fillRect(self.rect(), QColor(tb["frame_fill"]))
            p.fillRect(self.rect().adjusted(edge, edge, -edge, -edge), QColor(theme.cur["chrome"]))
        if not self.isMaximized():
            if tb.get("frame_hi"):      # glass frames have a light inner edge
                p.setPen(QColor(255, 255, 255, 140))
                p.drawRect(self.rect().adjusted(1, 1, -2, -2))
            p.setPen(QColor(tb["frame"]))
            p.drawRect(self.rect().adjusted(0, 0, -1, -1))
            if tb.get("client_border") and edge > 1:
                p.setPen(QColor(tb["client_border"]))
                p.drawRect(self.rect().adjusted(edge - 1, edge + self.topbar.height() - 1, -edge, -edge))
        p.end()

    def changeEvent(self, e):
        super().changeEvent(e)
        if e.type() == QEvent.Type.WindowStateChange and hasattr(self, "topbar"):
            self._fit_frame()
        elif e.type() == QEvent.Type.ActivationChange and hasattr(self, "topbar"):
            self.topbar.update()
            for b in self.topbar.buttons.values():
                b.update()

    def toggle_fullscreen(self, on):
        self.showFullScreen() if on else self.showNormal()

    def _on_contents(self):
        self._schedule()
        self._outline_timer.start()
        self.findbar.refresh() if self.findbar.isVisible() and not self.findbar.find.hasFocus() else None

    def _schedule(self):
        self._backup_timer.start()
        self._count_timer.start()

    def _write_backup(self):
        if self._dirty():
            try:
                self.backup.write(self._tab_list(), self.styles, self.path)
            except Exception as e:
                self.statusBar().showMessage(f"Backup failed: {e}", 5000)

    def _update_title(self, *_):
        if self.home:
            self.setWindowTitle(f"Dashboard — {APP}")
            return
        if self.md_mode:
            name = Path(self.md_path).name if self.md_path else (Path(self.path).with_suffix(".md").name if self.path else "Untitled.md")
            dot = " •" if self.md.document().isModified() else ""
            self.setWindowTitle(f"{name}{dot} — Markdown view — {APP}")
            return
        name = Path(self.path).name if self.path else "Untitled"
        dot = " •" if self.tabs and self._dirty() else ""
        self.setWindowTitle(f"{name}{dot} — {APP}")

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self._place_overlays()

    def closeEvent(self, e):
        if self.maybe_save():
            self.backup.clear()
            e.accept()
        else:
            e.ignore()
