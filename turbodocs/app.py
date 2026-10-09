"""Application entry point (`turbodocs` on the command line)."""
import sys
from pathlib import Path

from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication

from . import glass, theme
from .animation import Animator
from .prefs import prefs
from .window import APP, MainWindow

ICON = Path(__file__).parent / "resources" / "turbodocs.svg"
VERSION = "1.0.0"


def main(argv=None):
    argv = list(sys.argv if argv is None else argv)
    if any(a in ("-h", "--help") for a in argv[1:]):
        print(f"{APP} {VERSION}\nusage: turbodocs [file.docx]")
        return 0
    if "--version" in argv[1:]:
        print(f"{APP} {VERSION}")
        return 0
    app = QApplication(argv)
    app.setApplicationName(APP)
    app.setApplicationDisplayName(APP)
    app.setOrganizationName(APP)
    app.setApplicationVersion(VERSION)
    app.setDesktopFileName("turbodocs")  # Wayland app_id: ties the window to turbodocs.desktop and its icon
    app.setWindowIcon(QIcon(str(ICON)))
    theme.apply(app, prefs.get("theme"), prefs.get("accent"), prefs.get("ui_size"), prefs.get("ui_family"),
                prefs.get("ui_style"), prefs.get("translucent"))
    Animator(app)
    app.installEventFilter(glass.Glass(app))
    files = [a for a in argv[1:] if not a.startswith("-")]
    win = MainWindow(files[0] if files else None)
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
