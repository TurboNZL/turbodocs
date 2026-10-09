"""Read-only Markdown rendering of the document (the document itself is never converted)."""
import re

from PySide6.QtGui import QColor, QFont, QSyntaxHighlighter, QTextCharFormat, QTextCursor, QTextFormat

from . import images, styles, theme


def _inline(block) -> str:
    out = []
    for it in block:
        frag = it.fragment()
        fmt = frag.charFormat()
        if images.is_image(fmt):
            out.append("![image]()")
            continue
        text = frag.text().replace("￼", "").replace(" ", "  \n")
        if not text.strip():
            out.append(text)
            continue
        lead, core, trail = re.match(r"^(\s*)(.*?)(\s*)$", text, re.S).groups()
        if fmt.fontStrikeOut():
            core = f"~~{core}~~"
        if fmt.fontItalic():
            core = f"*{core}*"
        if fmt.fontWeight() >= QFont.Weight.DemiBold and not block.blockFormat().headingLevel():
            core = f"**{core}**"
        if fmt.hasProperty(QTextFormat.Property.BackgroundBrush) and fmt.background().style().value:
            core = f"=={core}=="
        if fmt.isAnchor() and fmt.anchorHref():
            core = f"[{core}]({fmt.anchorHref()})"
        out.append(lead + core + trail)
    return "".join(out).replace("  \n  \n", "\n\n")


def _table(doc, table) -> list:
    rows = []
    for r in range(table.rows()):
        cells = []
        for c in range(table.columns()):
            cell = table.cellAt(r, c)
            if cell.row() != r or cell.column() != c:
                cells.append("")
                continue
            parts, b = [], doc.findBlock(cell.firstPosition())
            while b.isValid() and b.position() <= cell.lastPosition():
                parts.append(_inline(b).strip())
                b = b.next()
            cells.append(" <br> ".join(p for p in parts if p).replace("|", "\\|"))
        rows.append("| " + " | ".join(cells) + " |")
    if rows:
        rows.insert(1, "|" + " --- |" * table.columns())
    return rows


def render(tabs) -> str:
    """tabs: [(title, QTextDocument)] -> markdown text"""
    chunks = []
    for i, (title, doc) in enumerate(tabs):
        lines, block, prev_list = [], doc.begin(), False
        while block.isValid():
            table = QTextCursor(block).currentTable()
            if table is not None:
                lines += ["", *_table(doc, table), ""]
                block = doc.findBlock(table.lastPosition()).next()
                prev_list = False
                continue
            key = styles.key_of_block(block)
            text = _inline(block).rstrip()
            lst = block.textList()
            if lst is not None:
                depth = max(lst.format().indent() - 1, 0)
                marker = "-" if key == "Bulleted list" else f"{lst.itemNumber(block) + 1}."
                lines.append("  " * depth + f"{marker} {text}")
                prev_list = True
            else:
                if prev_list and text:
                    lines.append("")
                prev_list = False
                prefix = {"Title": "# ", "Heading 1": "## ", "Heading 2": "### ", "Heading 3": "#### "}.get(key, "")
                if key == "Subtitle" and text:
                    text = f"*{text}*"
                lines.append(prefix + text if text else "")
                if text:
                    lines.append("")
            block = block.next()
        body = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip("\n")
        if len(tabs) > 1:
            body = f"<!-- tab: {title} -->\n\n{body}"
        chunks.append(body)
    return ("\n\n---\n\n".join(chunks) + "\n")


class MdHighlighter(QSyntaxHighlighter):
    def __init__(self, doc):
        super().__init__(doc)
        self._rules = []
        self.rebuild()

    def rebuild(self):
        c = theme.cur
        def fmt(color, bold=False, italic=False):
            f = QTextCharFormat()
            f.setForeground(QColor(color))
            if bold:
                f.setFontWeight(QFont.Weight.Bold)
            f.setFontItalic(italic)
            return f
        self._rules = [
            (re.compile(r"^#{1,6} .*$"), fmt(c["accent"], True)),
            (re.compile(r"^\s*(?:[-*+]|\d+\.) "), fmt(c["accent"])),
            (re.compile(r"\*\*[^*]+\*\*"), fmt(c["text"], True)),
            (re.compile(r"(?<!\*)\*[^*\n]+\*(?!\*)"), fmt(c["text"], False, True)),
            (re.compile(r"~~[^~]+~~"), fmt(c["muted"])),
            (re.compile(r"==[^=]+=="), fmt("#e6c34a")),
            (re.compile(r"`[^`]+`"), fmt("#c792ea")),
            (re.compile(r"!?\[[^\]]*\]\([^)]*\)"), fmt("#6cc4a1")),
            (re.compile(r"^\|.*\|$"), fmt(c["muted"])),
            (re.compile(r"<!--.*?-->|^---$"), fmt(c["muted"], False, True)),
        ]
        self.rehighlight()

    def highlightBlock(self, text):
        for rx, f in self._rules:
            for m in rx.finditer(text):
                self.setFormat(m.start(), m.end() - m.start(), f)
