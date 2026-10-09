from PySide6.QtWidgets import (QCheckBox, QDialog, QDialogButtonBox, QFormLayout, QGridLayout, QLabel, QLineEdit,
                               QSpinBox, QVBoxLayout)


def text_stats(text: str) -> dict:
    text = text.replace("￼", " ").replace(" ", "\n")
    words = len(text.split())
    return dict(words=words, chars=len(text.replace("\n", "").replace(" ", "")),
                nospace=len("".join(text.split())),
                paras=sum(1 for p in text.split(" ") if p.strip()))


class WordCountDialog(QDialog):
    """scopes: ordered {label: stats dict}"""

    def __init__(self, parent, scopes, show_in_status, on_toggle):
        super().__init__(parent)
        self.setWindowTitle("Word count")
        lay = QVBoxLayout(self)
        grid = QGridLayout()
        grid.setHorizontalSpacing(22)
        grid.setVerticalSpacing(6)
        rows = (("Words", "words"), ("Characters", "chars"), ("Characters excluding spaces", "nospace"),
                ("Paragraphs", "paras"))
        for c, label in enumerate(scopes, 1):
            h = QLabel(label)
            h.setObjectName("Muted")
            grid.addWidget(h, 0, c)
        for r, (name, key) in enumerate(rows, 1):
            grid.addWidget(QLabel(name), r, 0)
            for c, stats in enumerate(scopes.values(), 1):
                grid.addWidget(QLabel(f"{stats[key]:,}"), r, c)
        grid.addWidget(QLabel("Reading time"), len(rows) + 1, 0)
        for c, stats in enumerate(scopes.values(), 1):
            mins = max(1, round(stats["words"] / 230)) if stats["words"] else 0
            grid.addWidget(QLabel(f"{mins} min"), len(rows) + 1, c)
        lay.addLayout(grid)
        box = QCheckBox("Show word count in the status bar")
        box.setChecked(show_in_status)
        box.toggled.connect(on_toggle)
        lay.addWidget(box)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)


class SplitCellDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Split cell")
        form = QFormLayout(self)
        self.cols, self.rows = QSpinBox(), QSpinBox()
        for sp, v in ((self.cols, 2), (self.rows, 1)):
            sp.setRange(1, 12)
            sp.setValue(v)
        form.addRow("Columns", self.cols)
        form.addRow("Rows", self.rows)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        form.addRow(bb)


class TableDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Insert table")
        form = QFormLayout(self)
        self.rows, self.cols = QSpinBox(), QSpinBox()
        for sp in (self.rows, self.cols):
            sp.setRange(1, 50)
            sp.setValue(3)
        form.addRow("Rows", self.rows)
        form.addRow("Columns", self.cols)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        form.addRow(bb)


class LinkDialog(QDialog):
    def __init__(self, parent, text="", url="", has_selection=False):
        super().__init__(parent)
        self.setWindowTitle("Insert link")
        form = QFormLayout(self)
        self.text, self.url = QLineEdit(text), QLineEdit(url)
        self.url.setPlaceholderText("https://")
        self.url.setMinimumWidth(340)
        if not has_selection:
            form.addRow("Text", self.text)
        form.addRow("Link", self.url)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        form.addRow(bb)
