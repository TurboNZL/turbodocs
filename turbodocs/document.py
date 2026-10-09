"""Factory for tab documents."""
from PySide6.QtGui import QTextCursor, QTextDocument

from . import images
from .styles import DocStyles

DOC_MARGIN = 32


class DocMeta:
    def __init__(self, styles: DocStyles, title: str):
        self.styles, self.title = styles, title


def new_document(styles: DocStyles, title="Untitled", parent=None) -> QTextDocument:
    d = QTextDocument(parent)
    d.setDocumentMargin(DOC_MARGIN)
    d.setIndentWidth(36)
    d.setDefaultFont(styles.base_font())
    d._handler = images.ImageHandler()  # kept alive for the layout
    d.documentLayout().registerHandler(images.IMG_TYPE, d._handler)
    d.meta = DocMeta(styles, title)
    return d


def reset_blank(doc: QTextDocument):
    """Empty the document back to a single Normal paragraph (no undo history, not modified)."""
    st = doc.meta.styles
    doc.setUndoRedoEnabled(False)
    doc.clear()
    c = QTextCursor(doc)
    c.setBlockFormat(st.block_format("Normal"))
    doc.setUndoRedoEnabled(True)
    doc.setModified(False)
