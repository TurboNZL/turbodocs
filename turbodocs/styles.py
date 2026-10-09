"""Paragraph styles. A DocStyles instance belongs to one document (shared by all its tabs)."""
import json
from dataclasses import asdict, dataclass, fields

from PySide6.QtGui import QColor, QFont, QTextBlockFormat, QTextCharFormat, QTextFormat, QTextListFormat

from .prefs import prefs

PROP_STYLE = QTextFormat.UserProperty + 1
PX_PER_PT = 96 / 72

ORDER = ["Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "Bulleted list", "Numbered list"]
LIST_STYLES = ("Bulleted list", "Numbered list")
DOCX_NAME = {"Normal": "Normal", "Title": "Title", "Subtitle": "Subtitle", "Heading 1": "Heading 1",
             "Heading 2": "Heading 2", "Heading 3": "Heading 3", "Bulleted list": "List Bullet",
             "Numbered list": "List Number"}
STYLED = ("Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3")  # editable definitions
FROM_DOCX = {v: k for k, v in DOCX_NAME.items() if k != "Normal"}
FROM_DOCX.update({"Heading 4": "Heading 3", "Heading 5": "Heading 3", "Heading 6": "Heading 3"})
HEADING_LEVEL = {"Heading 1": 1, "Heading 2": 2, "Heading 3": 3}


@dataclass
class StyleDef:
    size: float = 0.0          # pt; 0 = inherit the document default
    bold: bool = False
    italic: bool = False
    family: str = ""
    color: str = ""
    before: float = 0.0        # px
    after: float = 6.0         # px
    line: float = 1.18         # line-height multiple


def factory_defs() -> dict:
    d = {
        "Normal": StyleDef(),
        "Title": StyleDef(size=28, bold=True, after=8),
        "Subtitle": StyleDef(size=15, italic=True, color="#808080", after=8),
        "Heading 1": StyleDef(size=22, bold=True, before=18, after=8),
        "Heading 2": StyleDef(size=17, bold=True, before=14, after=8),
        "Heading 3": StyleDef(size=14, bold=True, before=10, after=8),
    }
    return d


class DocStyles:
    def __init__(self, defs=None, base_family="", base_size=0.0):
        self.defs = defs or user_defaults()
        self.page_color = ""  # per document; empty = follow the colour theme
        self.base_family = base_family or prefs.get("doc_family")
        self.base_size = base_size or prefs.get("doc_size")
        if not self.base_family:
            from . import theme
            self.base_family = theme.doc_font_family()

    def copy(self):
        c = DocStyles({k: StyleDef(**asdict(v)) for k, v in self.defs.items()}, self.base_family, self.base_size)
        c.page_color = self.page_color
        return c

    def def_for(self, key) -> StyleDef:
        return self.defs.get(key) or self.defs["Normal"]

    def base_font(self) -> QFont:
        return QFont(self.base_family, int(self.base_size)) if self.base_size == int(self.base_size) else \
            _pt_font(self.base_family, self.base_size)

    # ---- formats
    def block_format(self, key) -> QTextBlockFormat:
        d = self.def_for("Normal" if key in LIST_STYLES else key)
        bf = QTextBlockFormat()
        bf.setProperty(PROP_STYLE, key)
        bf.setHeadingLevel(HEADING_LEVEL.get(key, 0))
        bf.setLineHeight(d.line * 100, QTextBlockFormat.LineHeightTypes.ProportionalHeight.value)
        bf.setTopMargin(d.before)
        bf.setBottomMargin(d.after)
        return bf

    def char_format(self, key) -> QTextCharFormat:
        cf = QTextCharFormat()
        if key in LIST_STYLES:
            return cf
        d = self.def_for(key)
        if d.size:
            cf.setFontPointSize(d.size)
        if d.bold:
            cf.setFontWeight(QFont.Weight.Bold)
        if d.italic:
            cf.setFontItalic(True)
        if d.family:
            cf.setFontFamilies([d.family])
        if d.color:
            cf.setForeground(QColor(d.color))
        return cf

    def has_look(self, key) -> bool:
        return key != "Normal" and key not in LIST_STYLES

    # ---- persistence of user defaults
    def to_overrides(self) -> dict:
        base = factory_defs()
        out = {}
        for k, v in self.defs.items():
            diff = {f.name: getattr(v, f.name) for f in fields(StyleDef) if getattr(v, f.name) != getattr(base[k], f.name)}
            if diff:
                out[k] = diff
        return out


def _pt_font(family, size):
    f = QFont(family)
    f.setPointSizeF(size)
    return f


def user_defaults() -> dict:
    defs = factory_defs()
    try:
        over = json.loads(prefs.get("styles_json"))
    except ValueError:
        over = {}
    for k, diff in over.items():
        if k in defs:
            for name, val in diff.items():
                if hasattr(defs[k], name):
                    setattr(defs[k], name, val)
    defs["Normal"].line = prefs.get("line_spacing") if "line" not in over.get("Normal", {}) else defs["Normal"].line
    defs["Normal"].after = prefs.get("para_after") if "after" not in over.get("Normal", {}) else defs["Normal"].after
    for k in STYLED[1:]:
        if "line" not in over.get(k, {}):
            defs[k].line = defs["Normal"].line
    return defs


def list_format(key, indent=1) -> QTextListFormat:
    lf = QTextListFormat()
    lf.setStyle(QTextListFormat.Style.ListDisc if key == "Bulleted list" else QTextListFormat.Style.ListDecimal)
    lf.setIndent(indent)
    return lf


def key_of_block(block) -> str:
    bf = block.blockFormat()
    key = bf.property(PROP_STYLE)
    lst = block.textList()
    if lst is not None:
        bullets = (QTextListFormat.Style.ListDisc, QTextListFormat.Style.ListCircle, QTextListFormat.Style.ListSquare)
        return "Bulleted list" if lst.format().style() in bullets else "Numbered list"
    if isinstance(key, str) and key in ORDER and key not in LIST_STYLES:
        return key
    lvl = bf.headingLevel()
    return f"Heading {min(lvl, 3)}" if lvl else "Normal"
