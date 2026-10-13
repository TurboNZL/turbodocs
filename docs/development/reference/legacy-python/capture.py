import os, sys
os.environ["QT_QPA_PLATFORM"] = "offscreen"
sys.path.insert(0, "<checkout of legacy/python>")
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication
from turbodocs import glass, theme
from turbodocs.animation import Animator
from turbodocs.prefs import prefs
from turbodocs.window import APP, MainWindow
from turbodocs.app import ICON
from turbodocs import backup
backup.orphans = lambda: []
from PySide6.QtWidgets import QMessageBox
QMessageBox.question = staticmethod(lambda *a, **k: QMessageBox.StandardButton.Discard)  # headless: no modal prompts

OUT = sys.argv[1]; DOC = sys.argv[2]
app = QApplication(["turbodocs"])
app.setApplicationName(APP); app.setOrganizationName(APP)
app.setWindowIcon(QIcon(str(ICON)))

def look(name, iface):
    theme.apply(app, name, "", prefs.get("ui_size"), prefs.get("ui_family"), iface, False)

def shot(w, name):
    app.processEvents(); app.processEvents()
    ok = w.grab().save(f"{OUT}/{name}.png"); print(name, ok, w.size().width(), w.size().height())

look("Graphite", "Modern")
Animator(app)
win = MainWindow(DOC)
win.resize(1280, 860); win.show(); app.processEvents()
shot(win, "01-editor-graphite-modern")
# menus
for title in ("File", "Format", "Insert"):
    for m in win._menus:
        if m.title() == title:
            m.adjustSize(); m.ensurePolished()
            m.grab().save(f"{OUT}/menu-{title.lower()}.png"); print("menu", title)
# tabs panel + other looks
win.a_tabs.trigger(); shot(win, "02-tabs-panel")
win.a_tabs.trigger()
for name, iface, tag in (("Paper", "Modern", "03-editor-paper-modern"), ("Windows 11 Light", "Windows 11", "04-editor-win11-light"),
                         ("Adwaita Dark", "GNOME (Adwaita)", "05-editor-adwaita-dark"), ("Windows 7 Aero", "Windows 7", "06-editor-win7-aero")):
    look(name, iface); app.processEvents(); shot(win, tag)
look("Graphite", "Modern")
win.a_home.trigger(); shot(win, "07-dashboard")
from PySide6.QtCore import QTimer
def grab_top(name, skip):
    for w in app.topLevelWidgets():
        if w.isVisible() and w is not win and w not in skip and w.size().width() > 200:
            w.grab().save(f"{OUT}/{name}.png"); print(name, w.windowTitle(), w.size().width(), w.size().height()); w.close(); return
    print(name, "none found")
before = set(app.topLevelWidgets())
QTimer.singleShot(900, lambda: grab_top("08-preferences", before))
win.a_prefs.trigger()
app.processEvents()
look("Graphite", "Modern")
before = set(app.topLevelWidgets())
win.a_home.trigger() if False else None
QTimer.singleShot(900, lambda: grab_top("09-width-popup", before))
win._show_layout()
