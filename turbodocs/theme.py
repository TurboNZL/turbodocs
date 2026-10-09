"""Colour themes (palette + tie-in fonts), interface styles (widget look) and preset bundles of both."""
from pathlib import Path

from PySide6.QtCore import QStandardPaths
from PySide6.QtGui import QColor, QFont, QFontDatabase, QPalette

FONT_DIR = Path(__file__).parent / "resources" / "fonts"


def P(dark, bg, chrome, raised, hover, border, text, muted, accent, selection, ui, doc, sel_text=None):
    return dict(dark=dark, bg=bg, chrome=chrome, raised=raised, hover=hover, border=border, text=text, muted=muted,
                accent=accent, selection=selection, ui=ui, doc=doc, sel_text=sel_text)


SANS_DOC = ["Carlito", "Source Sans 3", "Inter", "Noto Sans", "DejaVu Sans"]
MONO = ["JetBrains Mono", "Hack", "IBM Plex Mono", "DejaVu Sans Mono"]
PRESETS = {
    # --- dark
    "Graphite": P(True, "#1e1e1e", "#252525", "#2d2d2d", "#333333", "#303030", "#d4d4d4", "#858585", "#5b9cf6", "#264f78", ["Inter", "Noto Sans"], SANS_DOC),
    "Midnight": P(True, "#14161c", "#1a1d26", "#232734", "#2a2f3f", "#262b3a", "#c9d1e6", "#7d869e", "#7aa2f7", "#2f4670", ["Work Sans", "Inter"], SANS_DOC),
    "AMOLED Black": P(True, "#000000", "#0b0b0b", "#161616", "#222222", "#1c1c1c", "#d8d8d8", "#777777", "#4dabf7", "#17324d", ["Inter", "Noto Sans"], SANS_DOC),
    "Nord": P(True, "#2e3440", "#343b49", "#3b4252", "#434c5e", "#3f4757", "#d8dee9", "#8892a6", "#88c0d0", "#4c566a", ["IBM Plex Sans", "Noto Sans"], ["IBM Plex Sans", "Carlito"]),
    "Tokyo Night": P(True, "#1a1b26", "#16161e", "#24283b", "#2f334d", "#292e42", "#c0caf5", "#737aa2", "#7aa2f7", "#2d3f76", ["IBM Plex Sans", "Noto Sans"], ["IBM Plex Sans", "Carlito"]),
    "Dracula": P(True, "#282a36", "#21222c", "#343746", "#44475a", "#3a3d4f", "#f8f8f2", "#8c93b8", "#bd93f9", "#44475a", ["Fira Sans", "Noto Sans"], ["Fira Sans", "Carlito"]),
    "Gruvbox Dark": P(True, "#282828", "#32302f", "#3c3836", "#504945", "#45403d", "#ebdbb2", "#a89984", "#fabd2f", "#5a4a1c", ["Fira Sans", "Noto Sans"], ["Fira Sans", "Carlito"]),
    "Catppuccin Mocha": P(True, "#1e1e2e", "#181825", "#313244", "#45475a", "#313244", "#cdd6f4", "#8e92ad", "#cba6f7", "#45386b", ["Inter", "Noto Sans"], SANS_DOC),
    "Rosé Pine": P(True, "#191724", "#1f1d2e", "#26233a", "#312e47", "#2a2740", "#e0def4", "#908caa", "#c4a7e7", "#403d52", ["Fira Sans", "Noto Sans"], ["Fira Sans", "Carlito"]),
    "Everforest": P(True, "#2d353b", "#343f44", "#3d484d", "#475258", "#3d484d", "#d3c6aa", "#859289", "#a7c080", "#425047", ["Open Sans", "Noto Sans"], ["Open Sans", "Carlito"]),
    "Ayu Mirage": P(True, "#1f2430", "#232834", "#2d3343", "#383f52", "#2b3040", "#cccac2", "#707a8c", "#ffcc66", "#34455a", ["IBM Plex Sans", "Noto Sans"], ["IBM Plex Sans", "Carlito"]),
    "Solarized Dark": P(True, "#002b36", "#073642", "#0b3f4c", "#124a58", "#0f4452", "#a9b6b8", "#657b83", "#2aa198", "#1b5563", ["Fira Sans", "Noto Sans"], ["Fira Sans", "Carlito"]),
    "Breeze Dark": P(True, "#232629", "#31363b", "#3b4045", "#475057", "#4d4d4d", "#eff0f1", "#a1a9b1", "#3daee9", "#1f5f80", ["Noto Sans", "DejaVu Sans"], ["Noto Sans", "Carlito"]),
    "Adwaita Dark": P(True, "#1e1e1e", "#242424", "#383838", "#444444", "#353535", "#ffffff", "#9a9996", "#3584e4", "#1c4d85", ["Adwaita Sans", "Inter", "Cantarell", "Noto Sans"], ["Adwaita Sans", "Inter", "Cantarell", "Noto Sans"]),
    "Windows 10 Dark": P(True, "#1e1e1e", "#2b2b2b", "#333333", "#3f3f3f", "#555555", "#f0f0f0", "#9a9a9a", "#0078d7", "#264f78", ["Segoe UI", "Open Sans", "Noto Sans"], ["Calibri", "Carlito"]),
    "Windows 11 Dark": P(True, "#202020", "#2c2c2c", "#343434", "#3d3d3d", "#3c3c3c", "#ffffff", "#b4b4b4", "#60cdff", "#0b4a6f", ["Segoe UI Variable", "Segoe UI", "Inter", "Noto Sans"], ["Aptos", "Calibri", "Carlito"]),
    "macOS Dark": P(True, "#1e1e1e", "#2a2a2c", "#3a3a3c", "#48484a", "#38383a", "#f5f5f7", "#98989d", "#0a84ff", "#1e4f8c", ["SF Pro Text", "Inter", "Noto Sans"], ["Helvetica Neue", "Inter", "Carlito"]),
    "Retro Terminal": P(True, "#0a0f0a", "#0e140e", "#142014", "#1b2b1b", "#1f3a1f", "#33ff66", "#1f9940", "#33ff66", "#0f4a1f", MONO, MONO, "#9bffb5"),
    "High Contrast": P(True, "#000000", "#000000", "#1a1a1a", "#333333", "#ffffff", "#ffffff", "#cccccc", "#ffff00", "#0000cc", ["Inter", "Noto Sans"], SANS_DOC, "#ffffff"),
    # --- light
    "Paper": P(False, "#ffffff", "#f3f3f3", "#e8e8e8", "#dedede", "#dcdcdc", "#1f1f1f", "#6f6f6f", "#1a73e8", "#bcd7fb", ["Inter", "Noto Sans"], SANS_DOC),
    "Sepia": P(False, "#f6efdf", "#ece3cf", "#e2d8c2", "#d9ceb5", "#d6cab0", "#3b3326", "#857a66", "#b5651d", "#e3c79a", ["Fira Sans", "Noto Sans"], ["Lora", "Noto Serif", "DejaVu Serif"]),
    "Solarized Light": P(False, "#fdf6e3", "#eee8d5", "#e6dfc8", "#ddd6c0", "#d6cfb8", "#586e75", "#93a1a1", "#268bd2", "#d3e6e7", ["Fira Sans", "Noto Sans"], ["Fira Sans", "Carlito"]),
    "Breeze Light": P(False, "#fcfcfc", "#eff0f1", "#e3e5e7", "#d5d8db", "#bdc3c7", "#232627", "#6e7377", "#3daee9", "#b6def4", ["Noto Sans", "DejaVu Sans"], ["Noto Sans", "Carlito"]),
    "Adwaita Light": P(False, "#ffffff", "#fafafb", "#e8e8e9", "#dcdcdd", "#d9d9da", "#2e2e2e", "#77767b", "#3584e4", "#c1d9f6", ["Adwaita Sans", "Inter", "Cantarell", "Noto Sans"], ["Adwaita Sans", "Inter", "Cantarell", "Noto Sans"]),
    "macOS Light": P(False, "#ffffff", "#f2f2f2", "#ffffff", "#e5e5e5", "#d1d1d1", "#1d1d1f", "#86868b", "#007aff", "#b3d7ff", ["SF Pro Text", "Inter", "Noto Sans"], ["Helvetica Neue", "Inter", "Carlito"]),
    "Windows XP Luna": P(False, "#ffffff", "#ece9d8", "#f1efe2", "#fff3d0", "#aca899", "#000000", "#716f64", "#316ac5", "#316ac5", ["Tahoma", "Verdana", "DejaVu Sans"], ["Liberation Serif", "Times New Roman"], "#ffffff"),
    "Windows 7 Aero": P(False, "#ffffff", "#e4ecf7", "#f3f6fb", "#dbe8fb", "#a0b4cc", "#1e1e1e", "#6d7b8d", "#3399ff", "#cde4fb", ["Segoe UI", "Open Sans", "Noto Sans"], ["Calibri", "Carlito"]),
    "Windows 8": P(False, "#ffffff", "#f2f2f2", "#e1e1e1", "#d0d0d0", "#cccccc", "#1a1a1a", "#6a6a6a", "#2672ec", "#bcd6f9", ["Segoe UI", "Open Sans", "Noto Sans"], ["Calibri", "Carlito"]),
    "Windows 10 Light": P(False, "#ffffff", "#f0f0f0", "#e1e1e1", "#e5f1fb", "#adadad", "#000000", "#6d6d6d", "#0078d7", "#cce8ff", ["Segoe UI", "Open Sans", "Noto Sans"], ["Calibri", "Carlito"]),
    "Windows 11 Light": P(False, "#ffffff", "#f3f3f3", "#fbfbfb", "#eaeaea", "#e5e5e5", "#1b1b1b", "#616161", "#005fb8", "#cce4f7", ["Segoe UI Variable", "Segoe UI", "Inter", "Noto Sans"], ["Aptos", "Calibri", "Carlito"]),
    "Monokai": P(True, "#272822", "#1e1f1c", "#34352d", "#3e3d32", "#3a3b33", "#f8f8f2", "#8f8f80", "#a6e22e", "#49483e", ["JetBrains Mono"], ["Source Sans 3", "Carlito"], "#f8f8f2"),
    "One Dark": P(True, "#282c34", "#21252b", "#2c313a", "#3a3f4b", "#333842", "#abb2bf", "#7f848e", "#61afef", "#3e4451", ["Source Sans 3", "Noto Sans"], ["Source Sans 3", "Carlito"]),
    "GitHub Dark": P(True, "#0d1117", "#161b22", "#21262d", "#30363d", "#30363d", "#e6edf3", "#8b949e", "#2f81f7", "#1f3a5f", ["Inter", "Noto Sans"], SANS_DOC),
    "Night Owl": P(True, "#011627", "#01111d", "#0b2942", "#13385a", "#122d42", "#d6deeb", "#6c8aa3", "#82aaff", "#1d3b53", ["Space Grotesk", "Inter"], ["Source Sans 3", "Carlito"]),
    "Synthwave": P(True, "#262335", "#1f1a2e", "#34294f", "#41335f", "#3b2f5c", "#f0e9ff", "#9a8cc0", "#ff7edb", "#4a2f6e", ["Space Grotesk", "Inter"], ["Space Grotesk", "Carlito"]),
    "Kanagawa": P(True, "#1f1f28", "#16161d", "#2a2a37", "#363646", "#2a2a37", "#dcd7ba", "#8a8980", "#7e9cd8", "#2d4f67", ["Lora", "Noto Serif"], ["Lora", "Noto Serif"]),
    "Material Ocean": P(True, "#0f111a", "#090b10", "#1a1c25", "#232637", "#1f2233", "#a6accd", "#676e95", "#82aaff", "#1f2e52", ["Work Sans", "Inter"], ["Work Sans", "Carlito"]),
    "Ubuntu Aubergine": P(True, "#300a24", "#2c001e", "#3d1a33", "#4b2742", "#4a2a40", "#f2eef1", "#b69bad", "#e95420", "#6b2b55", ["Ubuntu", "Nunito", "Noto Sans"], ["Ubuntu", "Nunito", "Carlito"], "#ffffff"),
    "Yaru Dark": P(True, "#1f1f1f", "#2b2b2b", "#353535", "#404040", "#3d3d3d", "#eeeeec", "#a0a09d", "#e95420", "#7a3321", ["Ubuntu", "Nunito", "Noto Sans"], ["Ubuntu", "Nunito", "Carlito"], "#ffffff"),
    "GitHub Light": P(False, "#ffffff", "#f6f8fa", "#eaeef2", "#dde3ea", "#d0d7de", "#1f2328", "#656d76", "#0969da", "#b6e3ff", ["Inter", "Noto Sans"], SANS_DOC),
    "One Light": P(False, "#fafafa", "#eaeaeb", "#dfdfe0", "#d3d3d5", "#d4d4d6", "#383a42", "#8a8c93", "#4078f2", "#d0dcf8", ["Source Sans 3", "Noto Sans"], ["Source Sans 3", "Carlito"]),
    "Gruvbox Light": P(False, "#fbf1c7", "#ebdbb2", "#e0cfa5", "#d5c4a1", "#d5c4a1", "#3c3836", "#7c6f64", "#af3a03", "#e3d29c", ["Fira Sans", "Noto Sans"], ["Lora", "Noto Serif"]),
    "Catppuccin Latte": P(False, "#eff1f5", "#e6e9ef", "#dce0e8", "#ccd0da", "#ccd0da", "#4c4f69", "#7c7f93", "#8839ef", "#dcc8f7", ["Work Sans", "Inter"], ["Work Sans", "Carlito"]),
    "Rosé Pine Dawn": P(False, "#faf4ed", "#f2e9e1", "#ebe0d6", "#e4d8cd", "#dfd3c7", "#575279", "#8a8599", "#b4637a", "#e8d4d0", ["Nunito", "Noto Sans"], ["Nunito", "Carlito"]),
    "Yaru Light": P(False, "#ffffff", "#f2f1f0", "#e8e6e3", "#dedbd7", "#d3d0cb", "#2e3436", "#6f6c68", "#e95420", "#f6c6b4", ["Ubuntu", "Nunito", "Noto Sans"], ["Ubuntu", "Nunito", "Carlito"]),
    "Platinum": P(False, "#ffffff", "#dddddd", "#eeeeee", "#cfcfcf", "#7f7f7f", "#000000", "#555555", "#6666cc", "#b4b4e6", ["Geneva", "Charcoal", "Liberation Sans", "DejaVu Sans"], ["Geneva", "Liberation Sans", "Arimo"]),
    "Aqua": P(False, "#ffffff", "#e8e8e8", "#f7f7f7", "#d9e6f6", "#a4a4a4", "#000000", "#6a6a6a", "#3d7de0", "#b5d5ff", ["Lucida Grande", "DejaVu Sans", "Noto Sans"], ["Lucida Grande", "Helvetica Neue", "Inter"]),
    "Liquid Glass Light": P(False, "#ffffff", "#eef2f8", "#ffffff", "#e2e9f4", "#d6deeb", "#1d1d1f", "#74798a", "#0a84ff", "#bcdcff", ["SF Pro Text", "Inter", "Noto Sans"], ["Helvetica Neue", "Inter", "Carlito"]),
    "Liquid Glass Dark": P(True, "#1c1c20", "#26272e", "#34363f", "#3f424d", "#43464f", "#f5f5f7", "#9a9ca8", "#0a84ff", "#1e4f8c", ["SF Pro Text", "Inter", "Noto Sans"], ["Helvetica Neue", "Inter", "Carlito"]),
    "Windows 95": P(False, "#ffffff", "#c0c0c0", "#c0c0c0", "#d4d0c8", "#808080", "#000000", "#404040", "#000080", "#000080", ["Liberation Sans", "Nimbus Sans", "DejaVu Sans"], ["Liberation Sans", "Arimo"], "#ffffff"),
}
DEFAULT_THEME = "Graphite"


def M(kind, r, rp, border=False, pad="5px 6px", scroll=14, handle_r=4, bw=0.28, grad=False, focus_bottom=False,
      cb_r=4, btn_pad="6px 16px", flat_menu=False, mono=False, ms=140, fade=0, ease="outcubic"):
    return dict(kind=kind, r=r, rp=rp, field_border=border, pad=pad, scroll=scroll, handle_r=handle_r, bw=bw, grad=grad,
                focus_bottom=focus_bottom, cb_r=cb_r, btn_pad=btn_pad, flat_menu=flat_menu, mono=mono, ms=ms, fade=fade,
                ease=ease)


# Interface styles shape the widgets (and how they animate); colours come from the colour theme.
IFACES = {
    "Modern": M("modern", 6, 10, ms=140, fade=90),
    "Breeze": M("breeze", 3, 4, border=True, scroll=12, handle_r=2, cb_r=3, pad="4px 6px", ms=110, fade=60),
    "Rounded": M("rounded", 12, 16, pad="6px 10px", handle_r=6, cb_r=7, btn_pad="7px 18px", ms=180, fade=110),
    "GNOME (Adwaita)": M("gnome", 7, 12, pad="6px 10px", handle_r=5, bw=0.14, cb_r=5, btn_pad="7px 16px", ms=170, fade=120),
    "Windows XP": M("xp", 3, 4, border=True, pad="3px 6px", scroll=17, handle_r=3, bw=0.45, grad=True, cb_r=0,
                    btn_pad="4px 14px", flat_menu=True, ms=0),
    "Windows 7": M("aero", 3, 4, border=True, pad="3px 6px", scroll=17, handle_r=2, bw=0.38, grad=True, cb_r=2,
                   btn_pad="4px 14px", ms=260, fade=170),
    "Windows 8/10": M("win10", 0, 0, border=True, pad="4px 6px", scroll=16, handle_r=0, bw=0.38, cb_r=0,
                      btn_pad="5px 16px", flat_menu=True, ms=90),
    "Windows 11": M("win11", 4, 8, border=True, pad="5px 7px", scroll=12, handle_r=2, bw=0.16, focus_bottom=True,
                    cb_r=4, btn_pad="5px 16px", ms=83, fade=167, ease="linear"),
    "Windows 95": M("classic", 0, 0, border=True, pad="3px 5px", scroll=16, handle_r=0, cb_r=0, btn_pad="4px 14px",
                    flat_menu=True, ms=0),
    "Yaru (Ubuntu)": M("yaru", 4, 6, border=True, pad="5px 8px", scroll=12, handle_r=3, bw=0.22, cb_r=4,
                       btn_pad="6px 16px", ms=130, fade=80),
    "Mac OS 9 (Platinum)": M("platinum", 3, 4, border=True, pad="3px 6px", scroll=16, handle_r=0, bw=0.5, cb_r=0,
                             btn_pad="3px 14px", flat_menu=True, ms=0),
    "Mac OS X (Aqua)": M("aqua", 4, 8, border=True, pad="3px 7px", scroll=15, handle_r=7, bw=0.35, grad=True, cb_r=3,
                         btn_pad="3px 16px", ms=150, fade=90),
    "macOS (Liquid Glass)": M("glass", 10, 16, pad="6px 10px", scroll=12, handle_r=6, bw=0.12, cb_r=6,
                              btn_pad="6px 18px", ms=200, fade=130),
    "Terminal": M("term", 0, 0, border=True, pad="3px 6px", scroll=12, handle_r=0, bw=0.5, cb_r=0,
                  btn_pad="4px 14px", flat_menu=True, mono=True, ms=0),
    "Fusion (native)": None,
}
DEFAULT_IFACE = "Modern"

# One-click bundles: (colour theme, interface style). The font follows the colour theme.
BUNDLES = {
    "TurboDocs (default)": ("Graphite", "Modern"),
    "Windows 95": ("Windows 95", "Windows 95"),
    "Windows XP": ("Windows XP Luna", "Windows XP"),
    "Windows 7": ("Windows 7 Aero", "Windows 7"),
    "Windows 8": ("Windows 8", "Windows 8/10"),
    "Windows 10 (light)": ("Windows 10 Light", "Windows 8/10"),
    "Windows 10 (dark)": ("Windows 10 Dark", "Windows 8/10"),
    "Windows 11 (light)": ("Windows 11 Light", "Windows 11"),
    "Windows 11 (dark)": ("Windows 11 Dark", "Windows 11"),
    "GNOME / GTK4 (light)": ("Adwaita Light", "GNOME (Adwaita)"),
    "GNOME / GTK4 (dark)": ("Adwaita Dark", "GNOME (Adwaita)"),
    "KDE Breeze (light)": ("Breeze Light", "Breeze"),
    "KDE Breeze (dark)": ("Breeze Dark", "Breeze"),
    "Ubuntu Yaru (light)": ("Yaru Light", "Yaru (Ubuntu)"),
    "Ubuntu Yaru (dark)": ("Yaru Dark", "Yaru (Ubuntu)"),
    "Ubuntu Aubergine": ("Ubuntu Aubergine", "Yaru (Ubuntu)"),
    "macOS (light)": ("macOS Light", "Rounded"),
    "macOS (dark)": ("macOS Dark", "Rounded"),
    "Mac OS 9 Platinum": ("Platinum", "Mac OS 9 (Platinum)"),
    "Mac OS X Aqua": ("Aqua", "Mac OS X (Aqua)"),
    "macOS Liquid Glass (light)": ("Liquid Glass Light", "macOS (Liquid Glass)"),
    "macOS Liquid Glass (dark)": ("Liquid Glass Dark", "macOS (Liquid Glass)"),
    "GitHub (light)": ("GitHub Light", "Modern"),
    "GitHub (dark)": ("GitHub Dark", "Modern"),
    "Retro Terminal": ("Retro Terminal", "Terminal"),
}

cur = dict(PRESETS[DEFAULT_THEME], name=DEFAULT_THEME)
fx = dict(ms=0, fade=0)          # hover/open animation spec for the current interface style (see animation.py)
_fonts_loaded = False
translucent_on = False           # the Liquid Glass style is drawing see-through chrome (window is translucent)


def load_bundled_fonts():
    global _fonts_loaded
    if _fonts_loaded:
        return
    _fonts_loaded = True
    for f in sorted(FONT_DIR.glob("*.ttf")):
        QFontDatabase.addApplicationFont(str(f))


def first_available(candidates, fallback):
    have = set(QFontDatabase.families())
    return next((f for f in candidates if f in have), fallback)


def ui_font_family(app_default="") -> str:
    return first_available(cur["ui"], app_default or QFont().defaultFamily())


def doc_font_family() -> str:
    return first_available(cur["doc"], QFont().defaultFamily())


def mix(a: str, b: str, t: float) -> str:
    """Blend colour a towards b by t (0..1)."""
    ca, cb = QColor(a), QColor(b)
    return QColor(round(ca.red() + (cb.red() - ca.red()) * t), round(ca.green() + (cb.green() - ca.green()) * t),
                  round(ca.blue() + (cb.blue() - ca.blue()) * t)).name()


def contrast_ok(fg: QColor) -> bool:
    """True if fg is readable on the current canvas (used to drop 'automatic' black/white text from imports)."""
    return abs(fg.lightnessF() - QColor(cur["bg"]).lightnessF()) > 0.35


# ---- fills: a colour, or a list of (position, colour) gradient stops; QColor with alpha so they can fade
def Q(x) -> QColor:
    return x if isinstance(x, QColor) else QColor(x)


def clear(x, a=0):
    """The same fill, made transparent (a toolbar button at rest)."""
    if isinstance(x, list):
        return [(p, clear(col, a)) for p, col in x]
    c = QColor(Q(x))
    c.setAlpha(a)
    return c


def col_css(c: QColor) -> str:
    return c.name() if c.alpha() == 255 else f"rgba({c.red()},{c.green()},{c.blue()},{c.alpha()})"


def fill_css(f) -> str:
    if isinstance(f, (str, QColor)):
        return col_css(Q(f))
    return "qlineargradient(x1:0,y1:0,x2:0,y2:1," + ",".join(f"stop:{p} {col_css(Q(c))}" for p, c in f) + ")"


def lerp_color(a, b, t) -> QColor:
    a, b = Q(a), Q(b)
    return QColor(round(a.red() + (b.red() - a.red()) * t), round(a.green() + (b.green() - a.green()) * t),
                  round(a.blue() + (b.blue() - a.blue()) * t), round(a.alpha() + (b.alpha() - a.alpha()) * t))


def lerp_fill(a, b, t):
    """Blend two fills (solid or gradient); a solid is stretched to match a gradient's stops."""
    sa, sb = not isinstance(a, list), not isinstance(b, list)
    if sa and sb:
        return lerp_color(a, b, t)
    ref = b if sa else a
    a = [(p, a) for p, _ in ref] if sa else a
    b = [(p, b) for p, _ in ref] if sb else b
    return [(pa, lerp_color(ca, cb, t)) for (pa, ca), (_, cb) in zip(a, b)]


def _asset_dir() -> Path:
    d = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.CacheLocation))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _assets(c, on_accent, tick_col) -> dict:
    """SVGs the stylesheet refers to: arrows, check mark, radio dot (cached by colour)."""
    d = _asset_dir()

    def write(name, body):
        p = d / name
        p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">{body}</svg>')
        return p.as_posix()
    tag = lambda col: col.lstrip("#")  # noqa: E731
    m = c["muted"]
    chev = lambda d_: (f'<path d="{d_}" fill="none" stroke="{m}" stroke-width="1.8" '  # noqa: E731
                       'stroke-linecap="round" stroke-linejoin="round"/>')
    return dict(
        arrow=write(f"chev-{tag(m)}.svg", chev("M4 6.5 8 10.5 12 6.5")),
        up=write(f"up-{tag(m)}.svg", chev("M4.5 10 8 6.5 11.5 10")),
        down=write(f"down-{tag(m)}.svg", chev("M4.5 6.5 8 10 11.5 6.5")),
        check=write(f"check-{tag(on_accent)}.svg",
                    f'<path d="M3.6 8.4 6.7 11.5 12.6 4.9" fill="none" stroke="{on_accent}" stroke-width="2.2" '
                    'stroke-linecap="round" stroke-linejoin="round"/>'),
        tick=write(f"tick-{tag(tick_col)}.svg",
                   f'<path d="M3.4 8.4 6.6 11.6 12.8 4.6" fill="none" stroke="{tick_col}" stroke-width="2.3" '
                   'stroke-linecap="square" stroke-linejoin="miter"/>'),
        dot=write(f"dot-{tag(on_accent)}.svg", f'<circle cx="8" cy="8" r="3.2" fill="{on_accent}"/>'),
        tdot=write(f"tdot-{tag(tick_col)}.svg", f'<circle cx="8" cy="8" r="3.4" fill="{tick_col}"/>'),
    )


_applied_key = None


def apply(app, name=DEFAULT_THEME, accent="", ui_size=10, ui_family="", iface=DEFAULT_IFACE, translucent=False):
    """Apply colours, fonts and the widget stylesheet. Restyling the whole app is the slowest thing the program
    does, so an unchanged appearance is a no-op."""
    global cur, fx, _applied_key, translucent_on
    key = (name, accent, int(ui_size), ui_family, iface, bool(translucent))
    if key == _applied_key:
        return
    _applied_key = key
    translucent_on = bool(translucent and IFACES.get(iface) and IFACES[iface]["kind"] == "glass")
    load_bundled_fonts()
    base = PRESETS.get(name, PRESETS[DEFAULT_THEME])
    cur = dict(base, name=name)
    if accent and QColor(accent).isValid():
        cur["accent"] = accent
        cur["selection"] = mix(cur["bg"], accent, 0.35)
        if name == "Retro Terminal":    # a phosphor screen: every colour is a shade of the accent
            bg = cur["bg"]
            cur.update(chrome=mix(bg, accent, .05), raised=mix(bg, accent, .10), hover=mix(bg, accent, .18),
                       border=mix(bg, accent, .30), text=accent, muted=mix(bg, accent, .62),
                       selection=mix(bg, accent, .32), sel_text=mix(accent, "#ffffff", .55))
    c = cur
    m = IFACES.get(iface, IFACES[DEFAULT_IFACE])
    cur["iface"] = m["kind"] if m else "fusion"
    family = ui_family or first_available(c["ui"], app.font().family())
    if m and m["mono"] and not ui_family:
        family = first_available(MONO, family)
    if app.style().name().lower() != "fusion":   # setStyle() re-polishes every widget, even for the same style
        app.setStyle("Fusion")
    app.setFont(QFont(family, int(ui_size)))
    sel_text = c.get("sel_text") or ("#ffffff" if c["dark"] else "#000000")
    pal = QPalette()
    for role, col in {
        QPalette.ColorRole.Window: c["chrome"], QPalette.ColorRole.WindowText: c["text"],
        QPalette.ColorRole.Base: c["bg"], QPalette.ColorRole.AlternateBase: c["chrome"],
        QPalette.ColorRole.Text: c["text"], QPalette.ColorRole.Button: c["raised"],
        QPalette.ColorRole.ButtonText: c["text"], QPalette.ColorRole.ToolTipBase: c["raised"],
        QPalette.ColorRole.ToolTipText: c["text"], QPalette.ColorRole.Highlight: c["selection"],
        QPalette.ColorRole.HighlightedText: sel_text,
        QPalette.ColorRole.PlaceholderText: c["muted"], QPalette.ColorRole.Link: c["accent"],
    }.items():
        pal.setColor(role, QColor(col))
    dis = mix(c["text"], c["bg"], 0.6)
    for role in (QPalette.ColorRole.ButtonText, QPalette.ColorRole.Text, QPalette.ColorRole.WindowText):
        pal.setColor(QPalette.ColorGroup.Disabled, role, QColor(dis))
    app.setPalette(pal)
    on_accent = "#ffffff" if QColor(c["accent"]).lightnessF() < 0.62 else "#10151c"
    if not m:
        from . import titlebar
        fx = dict(ms=0, fade=0, titlebar=titlebar.spec_for("modern", c, not c["dark"], c["accent"], on_accent))
        app.setStyleSheet("")
        return
    qss, fx = build_qss(c, dis, m, on_accent, sel_text)
    app.setStyleSheet(qss)


def _aero_assets() -> dict:
    """Small SVGs for the Windows 7 look: scroll arrows, grippers, check mark and radio dot."""
    d = _asset_dir()

    def write(name, body, w=16, h=16):
        p = d / name
        p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>')
        return p.as_posix()
    tri = lambda pts: f'<polygon points="{pts}" fill="#4d6082"/>'  # noqa: E731
    grip = lambda vertical: "".join(  # noqa: E731
        (f'<line x1="{x}" y1="3" x2="{x}" y2="10" stroke="#8e8f8f"/><line x1="{x + 1}" y1="3" x2="{x + 1}" y2="10" stroke="#ffffff"/>'
         if vertical else
         f'<line x1="3" y1="{x}" x2="10" y2="{x}" stroke="#8e8f8f"/><line x1="3" y1="{x + 1}" x2="10" y2="{x + 1}" stroke="#ffffff"/>')
        for x in (4, 6, 8))
    return dict(
        up=write("aero-up.svg", tri("4,10 8,5 12,10")), down=write("aero-down.svg", tri("4,6 8,11 12,6")),
        left=write("aero-left.svg", tri("10,4 5,8 10,12")), right=write("aero-right.svg", tri("6,4 11,8 6,12")),
        grip_v=write("aero-gripv.svg", grip(True), 13, 13), grip_h=write("aero-griph.svg", grip(False), 13, 13),
        tick=write("aero-tick.svg", '<path d="M2.6 6.8 5.2 9.4 10.6 3.2" fill="none" stroke="#21433f" stroke-width="2" '
                   'stroke-linecap="round" stroke-linejoin="round"/>', 13, 13),
        rdot=write("aero-rdot.svg", '<circle cx="6.5" cy="6.5" r="2.6" fill="#21433f"/>', 13, 13))


def _glass(base, light):
    """Four-stop 'Aero' gloss: bright top half, a hard split at the middle, soft bottom."""
    if light:
        return [(0, mix(base, "#ffffff", .75)), (.5, mix(base, "#ffffff", .30)),
                (.51, mix(base, "#000000", .035)), (1, mix(base, "#ffffff", .30))]
    return [(0, mix(base, "#ffffff", .12)), (.5, mix(base, "#ffffff", .04)),
            (.51, mix(base, "#000000", .12)), (1, mix(base, "#000000", .02))]


def build_qss(c, dis, m, on_accent, sel_text):
    kind = m["kind"]
    r, rp, pad, cbr = m["r"], m["rp"], m["pad"], m["cb_r"]
    light = not c["dark"]
    acc = c["accent"]
    field = c["raised"]
    checked = mix(c["chrome"], acc, 0.30)
    line = mix(c["bg"], c["text"], m["bw"])                 # clearly visible outline colour
    fb = line if m["field_border"] else "transparent"
    box_border = mix(c["bg"], c["text"], 0.55)              # checkbox / radio outline: always legible
    tick_col, box_bg = on_accent, "transparent"
    a = _assets(c, on_accent, c["text"])

    # ---- button / toolbutton / card look per style: (fill, border) for rest and hover, plus pressed
    lighten = 0.5 if light else 0.10
    if m["grad"]:
        push = [(0, mix(field, "#ffffff", lighten)), (1, mix(field, "#000000", .07))]
        push_h = [(0, mix(c["hover"], "#ffffff", lighten)), (1, mix(c["hover"], acc, .18))]
    else:
        push, push_h = field, c["hover"]
    push_b = line if m["field_border"] else c["border"]
    push_bh = mix(push_b, acc, 0.5)
    push_p = c["raised"]
    tool_h = c["hover"]
    tool_bh = line if m["field_border"] else "transparent"
    tool_b = clear(line if m["field_border"] else c["hover"])
    tool_p = c["raised"]
    card, card_h = c["chrome"], mix(c["chrome"], acc, .08)
    card_b, card_bh = c["border"], acc
    extra = ""
    menu_sel_bg, menu_sel_fg, menu_bg, menu_r = c["hover"], c["text"], c["chrome"], max(r - 1, 0) if not m["flat_menu"] else 0
    menubar_bg, toolbar_bg, status_bg, window_bg = c["chrome"], c["chrome"], c["chrome"], c["chrome"]
    handle_v = handle_h = mix(c["bg"], c["text"], 0.2)
    handle_hv = mix(c["bg"], c["text"], 0.33)
    handle_b = "none"
    track = "transparent"
    field_bg = c["bg"] if m["field_border"] else field
    list_sel = checked
    cb_fill = acc
    cb_border = box_border
    cb_img, rb_img = a["check"], a["dot"]
    cb_checked_bg, cb_checked_border = acc, acc
    cb_size = 16
    push_bb = push_bbh = tool_bb = None      # optional distinct bottom-edge colours (elevation borders)
    default_fill = (acc, acc, acc, acc)       # accent (default) button: fill, hover fill, border, hover border

    if kind == "aero":
        if light:
            push = [(0, "#f2f2f2"), (.5, "#ebebeb"), (.51, "#dddddd"), (1, "#cfcfcf")]
            push_h = [(0, "#eaf6fd"), (.5, "#d9f0fc"), (.51, "#bee6fd"), (1, "#a7d9f5")]
            push_p = [(0, "#c2e4f6"), (.5, "#a5d6f1"), (.51, "#7fc3e8"), (1, "#68b3db")]
            push_b, push_bh = "#707070", "#3c7fb1"
            tool_h = [(0, "#fafcfe"), (.5, "#e9f3fc"), (.51, "#d5e8f8"), (1, "#e0eefb")]
            tool_p = [(0, "#d3e8f8"), (.5, "#bcdcf3"), (.51, "#9ccaec"), (1, "#a9d3f0")]
            tool_b, tool_bh = clear("#98b8d8"), "#98b8d8"
            card_b = "#a0b4cc"
        else:
            push, push_h, push_p = _glass(field, False), _glass(mix(field, acc, .3), False), _glass(mix(field, acc, .45), False)
            tool_h, tool_p = _glass(c["hover"], False), _glass(mix(c["hover"], acc, .4), False)
            tool_b, tool_bh = clear(line), line
        if light:   # Explorer-style: menu bar fades from white, tool bar is a smooth blue-grey gradient
            menubar_bg = [(0, "#fcfdfe"), (1, "#eef2f9")]
            toolbar_bg = [(0, "#f6f9fd"), (.5, "#e9eff8"), (1, "#d9e3f1")]
        else:
            menubar_bg = toolbar_bg = _glass(c["chrome"], light)
        status_bg = [(0, mix(c["chrome"], "#ffffff", .45 if light else .06)), (1, mix(c["chrome"], "#000000", .04))]
        field_bg = c["bg"]
        fb = "#abadb3" if light else line
        card = [(0, mix(c["chrome"], "#ffffff", .6 if light else .06)), (1, c["chrome"])]
        card_h = _glass(mix(c["chrome"], acc, .25), light)
        menu_bg = mix(c["chrome"], "#ffffff", .7) if light else c["chrome"]
        menu_sel_bg = fill_css(tool_h)
        list_sel = fill_css([(0, "#f1f8fe"), (.5, "#dcedfb"), (.51, "#cfe5f9"), (1, "#d9ebfb")]) if light else fill_css(tool_h)
        handle_v = handle_h = "#e3e3e3" if light else mix(c["bg"], c["text"], .2)
        handle_b = "1px solid #8e8f8f" if light else "none"
        track = "#f0f0f0" if light else "transparent"
        extra += f"""
QMenu {{ border: 1px solid {mix(line, '#000000', .1)}; border-radius: 3px; padding: 3px; }}
QMenu::item {{ margin: 1px 2px; padding: 5px 28px 5px 26px; border: 1px solid transparent; border-radius: 3px; }}
QMenu::item:selected {{ background: {fill_css(tool_h)}; border-color: {'#aed0ea' if light else line}; }}
QMainWindow::separator, QToolBar::separator {{ background: {mix(c['border'], '#ffffff', .6 if light else 0)}; width: 2px; margin: 4px 6px; }}
QScrollBar::handle:vertical {{ background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #f4f4f4,stop:.5 #e5e5e5,stop:.51 #d6d6d6,stop:1 #e8e8e8); border: 1px solid #8e8f8f; border-radius: 3px; margin: 1px; }}
QScrollBar::handle:horizontal {{ background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #f4f4f4,stop:.5 #e5e5e5,stop:.51 #d6d6d6,stop:1 #e8e8e8); border: 1px solid #8e8f8f; border-radius: 3px; margin: 1px; }}
QScrollBar::handle:vertical:hover {{ background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #eaf6fd,stop:.5 #d9f0fc,stop:.51 #bee6fd,stop:1 #cdeafc); border-color: #3c7fb1; }}
QScrollBar::handle:horizontal:hover {{ background: {fill_css([(0, '#eaf6fd'), (.5, '#d9f0fc'), (.51, '#bee6fd'), (1, '#cdeafc')])}; border-color: #3c7fb1; }}
QPushButton:default {{ border: 1px solid #3c7fb1; background: {fill_css([(0, '#eaf6fd'), (.5, '#d3ecfb'), (.51, '#b4e0fa'), (1, '#c4e9fc')])}; color: {c['text']}; }}
QSlider::groove:horizontal {{ height: 4px; background: #c9d3de; border: 1px solid #98a8ba; border-radius: 3px; }}
QSlider::handle:horizontal {{ background: {fill_css(push)}; border: 1px solid #707070; width: 12px; height: 12px; margin: -5px 0; border-radius: 6px; }}
"""
        if light:
            ar = _aero_assets()
            extra += f"""
QMenuBar::item {{ padding: 4px 9px; border: 1px solid transparent; border-radius: 3px; }}
QMenuBar::item:selected {{ background: {fill_css([(0, '#fafcfe'), (.5, '#e9f3fc'), (.51, '#d5e8f8'), (1, '#e0eefb')])}; border-color: #aed0ea; }}
QMenuBar::item:pressed {{ background: {fill_css([(0, '#e3effa'), (1, '#c7dff3')])}; border-color: #98b8d8; }}
QToolBar {{ border-bottom: 1px solid #b8c7da; }}
QToolButton {{ border-radius: 3px; }}
QToolButton:hover {{ border: 1px solid #98b8d8; }}
QToolButton:pressed, QToolButton:checked {{ border: 1px solid #6d9fc7; background: {fill_css([(0, '#d3e8f8'), (.5, '#bcdcf3'), (.51, '#9ccaec'), (1, '#a9d3f0')])}; }}
QToolButton:checked:hover {{ background: {fill_css([(0, '#c3dff4'), (.5, '#a9d3f0'), (.51, '#8ac0e6'), (1, '#9bcbea')])}; }}
QPushButton:disabled, QComboBox:disabled {{ background: #f4f4f4; border-color: #adb2b5; color: #838383; }}
QPushButton:pressed {{ border-color: #2c628b; }}
QPushButton:default {{ border: 1px solid #3c7fb1; }}
QPushButton:default:hover {{ border-color: #2f7cae; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ border: 1px solid #abadb3; border-top-color: #e2e3ea; border-radius: 2px; }}
QLineEdit:hover, QSpinBox:hover, QDoubleSpinBox:hover {{ border-color: #7eb4ea #5794bf #5794bf #5794bf; }}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ border-color: #7eb4ea #3d7bad #3d7bad #3d7bad; }}
QComboBox {{ padding: 2px 6px; }}
QComboBox::drop-down {{ border: none; width: 18px; }}
QGroupBox {{ border: 1px solid #d5dfe5; border-radius: 4px; }}
QToolTip {{ background: #f1f2f7; color: #575757; border: 1px solid #767676; border-radius: 0; padding: 3px 5px; }}
QCheckBox::indicator, QRadioButton::indicator {{ width: 13px; height: 13px; border: 1px solid #8e8f8f; border-radius: 2px;
    background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #dedede,stop:.35 #ffffff,stop:1 #ffffff); }}
QRadioButton::indicator {{ border-radius: 7px; }}
QCheckBox::indicator:hover, QRadioButton::indicator:hover {{ border-color: #3c7fb1; background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #b7dff5,stop:.4 #e3f4fc,stop:1 #ffffff); }}
QCheckBox::indicator:pressed, QRadioButton::indicator:pressed {{ border-color: #2c628b; background: #c2e3f6; }}
QCheckBox::indicator:checked {{ image: url({ar['tick']}); background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #dedede,stop:.35 #ffffff,stop:1 #ffffff); border-color: #8e8f8f; }}
QRadioButton::indicator:checked {{ image: url({ar['rdot']}); background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #dedede,stop:.35 #ffffff,stop:1 #ffffff); border-color: #8e8f8f; }}
QCheckBox::indicator:checked:hover, QRadioButton::indicator:checked:hover {{ border-color: #3c7fb1; }}
QScrollBar:vertical {{ width: 17px; background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #e6e6e6,stop:.5 #f2f2f2,stop:1 #f9f9f9); border-left: 1px solid #e4e4e4; margin: 17px 0; }}
QScrollBar:horizontal {{ height: 17px; background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #e6e6e6,stop:.5 #f2f2f2,stop:1 #f9f9f9); border-top: 1px solid #e4e4e4; margin: 0 17px; }}
QScrollBar::handle:vertical {{ margin: 0 1px; border-radius: 2px; min-height: 28px; image: url({ar['grip_v']}); }}
QScrollBar::handle:horizontal {{ margin: 1px 0; border-radius: 2px; min-width: 28px; image: url({ar['grip_h']}); }}
QScrollBar::handle:vertical:hover, QScrollBar::handle:horizontal:hover {{ border-color: #3c7fb1; }}
QScrollBar::handle:vertical:pressed, QScrollBar::handle:horizontal:pressed {{ border-color: #2c628b; background: {fill_css([(0, '#c2e4f6'), (.5, '#a5d6f1'), (.51, '#7fc3e8'), (1, '#68b3db')])}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 17px; width: 17px; subcontrol-origin: margin; background: {fill_css([(0, '#f4f4f4'), (.5, '#e8e8e8'), (.51, '#dadada'), (1, '#e9e9e9')])}; border: 1px solid #a6a6a6; border-radius: 2px; }}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ height: 17px; width: 17px; subcontrol-origin: margin; background: {fill_css([(0, '#f4f4f4'), (.5, '#e8e8e8'), (.51, '#dadada'), (1, '#e9e9e9')])}; border: 1px solid #a6a6a6; border-radius: 2px; }}
QScrollBar::sub-line:vertical {{ subcontrol-position: top; image: url({ar['up']}); }}
QScrollBar::add-line:vertical {{ subcontrol-position: bottom; image: url({ar['down']}); }}
QScrollBar::sub-line:horizontal {{ subcontrol-position: left; image: url({ar['left']}); }}
QScrollBar::add-line:horizontal {{ subcontrol-position: right; image: url({ar['right']}); }}
QScrollBar::sub-line:hover, QScrollBar::add-line:hover {{ background: {fill_css([(0, '#eaf6fd'), (.5, '#d9f0fc'), (.51, '#bee6fd'), (1, '#a7d9f5')])}; border-color: #3c7fb1; }}
QSlider::groove:horizontal {{ height: 4px; background: #d6d6d6; border: 1px solid #a6a6a6; border-radius: 2px; }}
QSlider::sub-page:horizontal {{ background: #d6d6d6; border-radius: 2px; }}
QSlider::handle:horizontal {{ background: {fill_css([(0, '#f7f7f7'), (.5, '#ebebeb'), (.51, '#dcdcdc'), (1, '#d0d0d0')])}; border: 1px solid #707070; width: 9px; height: 18px; margin: -8px 0; border-radius: 2px; }}
QSlider::handle:horizontal:hover {{ background: {fill_css([(0, '#eaf6fd'), (.5, '#d9f0fc'), (.51, '#bee6fd'), (1, '#a7d9f5')])}; border-color: #3c7fb1; }}
#Popup, #Floating, #FindBar, #ImageBar {{ border: 1px solid #8a9bb3; border-radius: 4px; }}
"""
    elif kind == "xp":
        if light:
            push = [(0, "#ffffff"), (.86, "#ecebe5"), (1, "#d6d0c5")]
            push_h = [(0, "#fffaf0"), (.86, "#fdecc6"), (1, "#f8d58b")]
            push_p = [(0, "#cecbba"), (1, "#e3e0d1")]
            push_b, push_bh = "#003c74", "#e5a02a"
            tool_h = [(0, "#f5f8ff"), (1, "#c1d2ee")]
            tool_p = [(0, "#9ebbe9"), (1, "#c1d2ee")]
            tool_b, tool_bh = clear("#316ac5"), "#316ac5"
            menubar_bg = "#ece9d8"
            toolbar_bg = [(0, "#fdfdfb"), (.5, "#f1efe2"), (1, "#e4e0cc")]
            status_bg = "#ece9d8"
            menu_bg, menu_sel_bg, menu_sel_fg = "#ffffff", acc, "#ffffff"
            line, fb = "#7f9db9", "#7f9db9"
            field_bg = "#ffffff"
            handle_v = handle_h = "#c1d3fb"
            handle_b = "1px solid #7b9be0"
            handle_hv = "#d4e0fd"
            track = "#f3f1e8"
            list_sel = acc
            cb_border, cb_checked_border, cb_checked_bg, box_bg = "#1c5180", "#1c5180", "#ffffff", "#ffffff"
            a.update(_assets(c, on_accent, "#21a121"))
            cb_img, rb_img = a["tick"], a["tdot"]
            card_b = "#aca899"
            card = "#f6f4ec"
            card_h = "#fff3d0"
            card_bh = "#e5a02a"
        extra += f"""
QMenu {{ border: 1px solid #aca899; padding: 2px; }}
QMenu::item {{ padding: 4px 24px 4px 26px; }}
QMenu::item:selected {{ color: #ffffff; }}
QPushButton:default {{ border: 2px solid {push_bh if not light else '#1c5180'}; }}
QScrollBar::handle:vertical {{ background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #c8d8fc,stop:.5 #b5c9f9,stop:1 #9db8f0); }}
QScrollBar::handle:horizontal {{ background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #c8d8fc,stop:.5 #b5c9f9,stop:1 #9db8f0); }}
QSlider::groove:horizontal {{ background: #ffffff; border: 1px solid #7f9db9; height: 4px; }}
"""
    elif kind == "classic":
        hi, sh, dk = "#ffffff", "#808080", "#404040"
        bev_out = f"border: 2px solid; border-top-color: {hi}; border-left-color: {hi}; border-right-color: {dk}; border-bottom-color: {dk};"
        bev_in = f"border: 2px solid; border-top-color: {sh}; border-left-color: {sh}; border-right-color: {hi}; border-bottom-color: {hi};"
        push, push_h, push_p = c["chrome"], c["chrome"], c["chrome"]
        tool_h, tool_p = c["chrome"], c["chrome"]
        menu_sel_bg, menu_sel_fg = acc, "#ffffff"
        list_sel, handle_v, handle_h, handle_hv = acc, c["chrome"], c["chrome"], c["chrome"]
        track = "#dfdfdf"
        cb_border, cb_checked_bg, cb_checked_border, box_bg = sh, "#ffffff", sh, "#ffffff"
        a.update(_assets(c, on_accent, "#000000"))
        cb_img, rb_img = a["tick"], a["tdot"]
        extra += f"""
QPushButton, QComboBox {{ {bev_out} border-radius: 0; background: {c['chrome']}; padding: 3px 12px; }}
QPushButton:hover, QComboBox:hover {{ background: {c['chrome']}; }}
QPushButton:pressed {{ {bev_in} padding: 4px 11px 2px 13px; background: {c['chrome']}; }}
QPushButton:default {{ {bev_out} background: {c['chrome']}; color: #000000; border-color: {hi}; border-right-color: #000000; border-bottom-color: #000000; }}
QPushButton:checked {{ {bev_in} background: #dfdfdf; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ {bev_in} border-radius: 0; background: #ffffff; padding: 1px 3px; }}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ {bev_in} }}
QComboBox QAbstractItemView {{ border: 1px solid #000000; background: #ffffff; selection-background-color: {acc}; selection-color: #ffffff; padding: 0; }}
QMenuBar {{ border-bottom: 1px solid {sh}; padding: 1px 2px; }}
QMenuBar::item {{ padding: 3px 8px; border-radius: 0; }}
QMenuBar::item:selected {{ background: {acc}; color: #ffffff; }}
QMenu {{ {bev_out} padding: 2px; }}
QMenu::item {{ padding: 4px 24px 4px 26px; border-radius: 0; }}
QMenu::item:selected {{ background: {acc}; color: #ffffff; }}
QToolBar {{ {bev_out} border-width: 1px; border-top-color: {hi}; padding: 2px 4px; }}
QToolButton {{ border: 1px solid transparent; border-radius: 0; padding: 2px 5px; }}
QToolButton:hover {{ border: 1px solid; border-top-color: {hi}; border-left-color: {hi}; border-right-color: {sh}; border-bottom-color: {sh}; background: {c['chrome']}; }}
QToolButton:pressed, QToolButton:checked {{ border: 1px solid; border-top-color: {sh}; border-left-color: {sh}; border-right-color: {hi}; border-bottom-color: {hi}; background: #dfdfdf; }}
QStatusBar {{ border-top: 1px solid {sh}; }}
QScrollBar:vertical, QScrollBar:horizontal {{ background: {track}; }}
QScrollBar::handle:vertical, QScrollBar::handle:horizontal {{ {bev_out} margin: 0; background: {c['chrome']}; border-radius: 0; }}
QCheckBox::indicator, QRadioButton::indicator {{ {bev_in} background: #ffffff; width: 12px; height: 12px; }}
QGroupBox {{ border: 2px groove {c['chrome']}; border-radius: 0; }}
QListWidget::item:selected {{ background: {acc}; color: #ffffff; }}
QTableWidget {{ {bev_in} border-radius: 0; }}
#Popup, #Floating, #FindBar, #ImageBar, #Card {{ {bev_out} border-radius: 0; }}
"""
        cb_size = 13
    elif kind == "win10":
        push, push_h, push_p = (field, mix(field, acc, .16 if light else .24), mix(field, acc, .30 if light else .40))
        push_b, push_bh = line, acc
        tool_h, tool_p = mix(c["chrome"], acc, .14 if light else .22), mix(c["chrome"], acc, .30 if light else .38)
        tool_b, tool_bh = clear(acc), clear(acc)
        menu_sel_bg = mix(c["chrome"], acc, .30 if light else .28)
        list_sel = menu_sel_bg
        cb_checked_bg, cb_checked_border, box_bg = c["bg"], c["text"], c["bg"]
        cb_border = mix(c["bg"], c["text"], .75)
        a.update(_assets(c, on_accent, c["text"]))
        cb_img, rb_img = a["tick"], a["tdot"]
        extra += f"""
QPushButton:pressed {{ background: {push_p}; border-color: {mix(acc, '#000000', .25)}; }}
QPushButton:default {{ background: {push}; color: {c['text']}; border: 2px solid {acc}; }}
QToolButton:pressed {{ background: {tool_p}; }}
QMenu {{ padding: 2px; }}
QMenu::item {{ padding: 6px 28px 6px 30px; }}
"""
    elif kind == "win11":
        # Fluent / WinUI 3 tokens: layered translucent fills, 4px controls, 8px flyouts, elevation borders
        base = c["chrome"]
        if light:
            push, push_h, push_p = mix(base, "#ffffff", .70), mix(base, "#f9f9f9", .50), mix(base, "#f9f9f9", .30)
            push_b, push_bb = mix(base, "#000000", .06), mix(base, "#000000", .16)
            tool_h, tool_p = mix(base, "#000000", .037), mix(base, "#000000", .024)
            strong, focus_bg = mix(c["bg"], "#000000", .45), "#ffffff"
            menu_bg, sel_hover = "#fcfcfc", mix("#fcfcfc", "#000000", .037)
            checked = mix(base, "#000000", .085)
            acc_h, acc_p = mix(acc, base, .10), mix(acc, base, .20)
            handle_v = handle_h = mix(c["bg"], "#000000", .45)
            handle_hv = mix(c["bg"], "#000000", .60)
            thumb_ring = "#ffffff"
        else:
            push, push_h, push_p = mix(base, "#ffffff", .0605), mix(base, "#ffffff", .0837), mix(base, "#ffffff", .0326)
            push_b = mix(base, "#ffffff", .07)
            push_bb = mix(base, "#ffffff", .05)
            tool_h, tool_p = mix(base, "#ffffff", .0605), mix(base, "#ffffff", .04)
            strong, focus_bg = mix(c["bg"], "#ffffff", .545), "#1f1f1f"
            menu_bg, sel_hover = "#2c2c2c", mix("#2c2c2c", "#ffffff", .0605)
            checked = mix(base, "#ffffff", .12)
            acc_h, acc_p = mix(acc, base, .10), mix(acc, base, .20)
            handle_v = handle_h = mix(c["bg"], "#ffffff", .545)
            handle_hv = mix(c["bg"], "#ffffff", .70)
            thumb_ring = "#454545"
        push_bh = push_b
        push_bbh = push_bb
        tool_b = tool_bh = clear(base)
        field_hover = push_h
        field_bg = push
        fb = push_b
        list_sel = sel_hover
        menu_sel_bg = sel_hover
        menu_r = 4
        cb_border = strong
        box_bg = mix(c["bg"], "#000000", .024) if light else mix(c["bg"], "#000000", .10)
        cb_checked_bg, cb_checked_border = acc, acc
        cb_size = 20
        default_fill = (acc, acc_h, mix(acc, "#ffffff", .08) if not light else mix(acc, "#ffffff", .08), acc_h)
        window_bg = menubar_bg = toolbar_bg = status_bg = c["chrome"]
        sep = mix(base, c["text"], .10)
        extra += f"""
QMenuBar {{ border-bottom: none; padding: 2px 6px; }}
QMenuBar::item {{ padding: 5px 10px; margin: 0 1px; border-radius: 4px; }}
QMenuBar::item:selected {{ background: {tool_h}; }}
QMenuBar::item:pressed {{ background: {tool_p}; }}
QToolBar {{ border-bottom: 1px solid {mix(base, c['text'], .06)}; padding: 4px 8px; spacing: 2px; }}
QToolBar::separator {{ width: 1px; background: {sep}; margin: 6px 6px; }}
QToolButton {{ border: 1px solid transparent; border-radius: 4px; padding: 4px 6px; }}
QToolButton:hover {{ background: {tool_h}; border-color: transparent; }}
QToolButton:pressed {{ background: {tool_p}; border-color: transparent; color: {c['muted']}; }}
QToolButton:checked {{ background: {checked}; border-color: transparent; }}
QToolButton:checked:hover {{ background: {mix(checked, c['text'], .05)}; }}
QPushButton {{ border-color: {push_b} {push_b} {push_bb} {push_b}; }}
QPushButton:hover {{ background: {push_h}; border-color: {push_b} {push_b} {push_bb} {push_b}; }}
QPushButton:pressed {{ background: {push_p}; border-color: {push_b}; color: {c['muted']}; }}
QPushButton:checked {{ background: {checked}; }}
QPushButton:default {{ background: {acc}; color: {on_accent}; border-color: {mix(acc, '#ffffff', .08)} {mix(acc, '#ffffff', .08)} {mix(acc, '#000000', .25)} {mix(acc, '#ffffff', .08)}; }}
QPushButton:default:hover {{ background: {acc_h}; }}
QPushButton:default:pressed {{ background: {acc_p}; color: {mix(on_accent, acc, .25)}; border-color: {acc_p}; }}
QPushButton:disabled {{ background: {mix(base, c['text'], .045)}; color: {dis}; border-color: transparent; }}
QComboBox {{ border-color: {push_b} {push_b} {push_bb} {push_b}; padding: 4px 8px; }}
QComboBox:hover {{ background: {push_h}; border-color: {push_b} {push_b} {push_bb} {push_b}; }}
QComboBox:on {{ background: {push_p}; }}
QComboBox:focus {{ border-color: {push_b} {push_b} {acc} {push_b}; }}
QComboBox::down-arrow {{ width: 10px; height: 10px; }}
QComboBox QAbstractItemView {{ background: {menu_bg}; border: 1px solid {mix(menu_bg, c['text'], .14)}; border-radius: 8px; padding: 4px; selection-background-color: {sel_hover}; selection-color: {c['text']}; }}
QComboBox QAbstractItemView::item {{ min-height: 24px; padding: 3px 8px; border-radius: 4px; margin: 1px 0; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ background: {push}; border: 1px solid {push_b}; border-bottom-color: {strong}; padding: 4px 8px 4px 8px; }}
QSpinBox, QDoubleSpinBox {{ padding: 4px 26px 4px 8px; }}
QLineEdit:hover, QSpinBox:hover, QDoubleSpinBox:hover {{ background: {push_h}; }}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ background: {focus_bg}; border: 1px solid {push_b}; border-bottom: 2px solid {acc}; padding-bottom: 3px; }}
QLineEdit:disabled, QSpinBox:disabled, QDoubleSpinBox:disabled {{ background: {mix(base, c['text'], .045)}; border-color: transparent; color: {dis}; }}
QMenu {{ background: {menu_bg}; border: 1px solid {mix(menu_bg, c['text'], .14)}; border-radius: 8px; padding: 4px; }}
QMenu::item {{ margin: 2px 2px; padding: 6px 22px 6px 26px; border-radius: 4px; background: transparent; }}
QMenu::item:selected {{ background: {sel_hover}; color: {c['text']}; }}
QMenu::item:pressed {{ background: {mix(menu_bg, c['text'], .03 if light else .04)}; }}
QMenu::separator {{ height: 1px; background: {sep}; margin: 4px 1px; }}
QMenu::right-arrow {{ width: 10px; height: 10px; margin-right: 8px; }}
QToolTip {{ background: {menu_bg}; color: {c['text']}; border: 1px solid {mix(menu_bg, c['text'], .14)}; padding: 5px 8px; }}
QListWidget::item {{ border-radius: 4px; margin: 1px 4px; padding: 7px 8px; }}
QListWidget::item:hover {{ background: {tool_h}; }}
QListWidget::item:selected {{ border-left: 3px solid {acc}; border-top-left-radius: 3px; border-bottom-left-radius: 3px; background: {sel_hover}; color: {c['text']}; }}
QCheckBox::indicator, QRadioButton::indicator {{ border: 1px solid {strong}; background: {box_bg}; }}
QCheckBox::indicator:hover, QRadioButton::indicator:hover {{ border-color: {strong}; background: {mix(box_bg, c['text'], .06)}; }}
QCheckBox::indicator:checked, QRadioButton::indicator:checked {{ background: {acc}; border-color: {acc}; }}
QCheckBox::indicator:checked:hover, QRadioButton::indicator:checked:hover {{ background: {acc_h}; border-color: {acc_h}; }}
QCheckBox::indicator:checked:pressed, QRadioButton::indicator:checked:pressed {{ background: {acc_p}; border-color: {acc_p}; }}
QCheckBox, QRadioButton {{ spacing: 8px; }}
QTabWidget::pane {{ border: 1px solid {push_b}; border-radius: 8px; }}
QGroupBox {{ border-radius: 8px; }}
QScrollBar:vertical {{ background: transparent; width: 12px; }}
QScrollBar:horizontal {{ background: transparent; height: 12px; }}
QScrollBar::handle:vertical {{ margin: 2px 4px; border-radius: 2px; min-height: 36px; }}
QScrollBar::handle:horizontal {{ margin: 4px 2px; border-radius: 2px; min-width: 36px; }}
QScrollBar::handle:vertical:hover, QScrollBar::handle:vertical:pressed {{ margin: 2px 3px; border-radius: 3px; }}
QScrollBar::handle:horizontal:hover, QScrollBar::handle:horizontal:pressed {{ margin: 3px 2px; border-radius: 3px; }}
QSlider::groove:horizontal {{ height: 4px; background: {mix(base, c['text'], .4 if light else .54)}; border-radius: 2px; }}
QSlider::sub-page:horizontal {{ background: {acc}; border-radius: 2px; height: 4px; }}
QSlider::handle:horizontal {{ background: {acc}; border: 4px solid {thumb_ring}; width: 12px; height: 12px; margin: -8px 0; border-radius: 10px; }}
QSlider::handle:horizontal:hover {{ border-width: 3px; width: 14px; height: 14px; margin: -8px 0; }}
QSlider::handle:horizontal:pressed {{ border-width: 5px; width: 10px; height: 10px; margin: -8px 0; }}
QStatusBar {{ border-top: none; }}
#Popup, #Floating, #FindBar, #ImageBar {{ border: 1px solid {mix(menu_bg, c['text'], .14)}; border-radius: 8px; }}
#Card {{ border-radius: 8px; }}
"""
    elif kind == "gnome":
        # libadwaita: borderless tinted buttons, 6px radii, headerbar tone for chrome, accent-filled suggested action
        hb = "#303030" if not light else "#ebebeb"
        tint = lambda t: mix(c["chrome"], c["text"], t)   # noqa: E731
        push, push_h, push_p = tint(.08 if light else .10), tint(.13 if light else .16), tint(.19 if light else .22)
        push_b = push_bh = "transparent"
        tool_h, tool_p, tool_b, tool_bh = tint(.09), tint(.15), clear(hb), clear(hb)
        menubar_bg = toolbar_bg = hb
        menu_bg = c["chrome"] if light else "#383838"
        menu_sel_bg = tint(.08 if light else .12)
        field_bg = tint(.06 if light else .08)
        list_sel = tint(.10 if light else .14)
        checked = tint(.14)
        extra += f"""
QMenuBar {{ border-bottom: none; padding: 0 8px; }}
QMenuBar::item {{ border-radius: 6px; padding: 5px 10px; margin: 5px 1px; }}
QPushButton {{ border: none; padding: 6px 14px; min-height: 22px; }}
QPushButton:default {{ background: {acc}; color: #ffffff; }}
QPushButton:default:hover {{ background: {mix(acc, '#ffffff', .12)}; }}
QToolBar {{ background: {hb}; border-bottom: 1px solid {mix(hb, '#000000', .12 if light else .35)}; padding: 6px 10px; spacing: 4px; }}
QToolButton {{ border: none; border-radius: 6px; }}
QMenu {{ border: 1px solid {mix(menu_bg, c['text'], .12)}; border-radius: 12px; padding: 6px; }}
QMenu::item {{ margin: 1px 0; border-radius: 6px; padding: 6px 28px 6px 28px; }}
QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox {{ border: 2px solid transparent; background: {field_bg}; }}
QComboBox:focus, QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ border: 2px solid {acc}; }}
#Popup, #Floating, #FindBar, #ImageBar {{ border: 1px solid {mix(menu_bg, c['text'], .12)}; border-radius: 12px; }}
#Card {{ border: 1px solid {mix(c['bg'], c['text'], .10)}; border-radius: 12px; }}
"""
    elif kind == "yaru":
        push = [(0, mix(field, "#ffffff", .12 if light else .06)), (1, field)]
        push_h = [(0, mix(c["hover"], "#ffffff", .15 if light else .06)), (1, c["hover"])]
        extra += f"""
QMenu::item:selected {{ background: {mix(c['chrome'], acc, .22)}; }}
QListWidget::item:selected {{ background: {acc}; color: #ffffff; }}
QToolButton:checked {{ border-color: {acc}; }}
"""
        list_sel = acc
    elif kind == "term":
        extra += f"""
QPushButton:hover, QToolButton:hover {{ background: {acc}; color: {c['bg']}; }}
QMenu::item:selected {{ background: {acc}; color: {c['bg']}; }}
"""
    elif kind == "rounded":
        extra += f"""
QMenu {{ border-radius: 14px; padding: 6px; }}
QMenu::item {{ border-radius: 9px; }}
"""

    elif kind == "platinum":
        push = [(0, "#ffffff"), (.45, "#e6e6e6"), (1, "#bdbdbd")]
        push_h = [(0, "#ffffff"), (.45, "#efefef"), (1, "#cbcbcb")]
        push_p = [(0, "#8c8c8c"), (1, "#b5b5b5")]
        push_b = push_bh = "#000000"
        tool_h, tool_p = [(0, "#ffffff"), (1, "#cfcfcf")], [(0, "#9c9c9c"), (1, "#c2c2c2")]
        tool_b, tool_bh = clear("#000000"), "#000000"
        menubar_bg, menu_bg = "#eeeeee", "#eeeeee"
        menu_sel_bg, list_sel = acc, acc
        field_bg = "#ffffff"
        fb = "#000000"
        extra += f"""
QMenuBar {{ border-bottom: 1px solid #000000; }}
QMenu {{ border: 1px solid #000000; padding: 2px; }}
QPushButton {{ border-radius: 6px; }}
QPushButton:default {{ border: 3px double #000000; background: {fill_css(push)}; color: #000000; }}
QToolButton:checked {{ background: {fill_css(tool_p)}; border-color: #000000; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ border: 1px solid #000000; border-radius: 0; }}
QScrollBar::handle:vertical {{ background: {fill_css([(0, '#ffffff'), (1, '#bcbcbc')])}; border: 1px solid #000000; }}
QScrollBar::handle:horizontal {{ background: {fill_css([(0, '#ffffff'), (1, '#bcbcbc')])}; border: 1px solid #000000; }}
"""
    elif kind == "aqua":
        gel = lambda a_, b_, c_, d_: [(0, a_), (.5, b_), (.51, c_), (1, d_)]   # noqa: E731
        push = gel("#ffffff", "#f3f3f3", "#dedede", "#f2f2f2")
        push_h = gel("#ffffff", "#e9f1fb", "#cfe0f5", "#e6f0fb")
        push_p = gel("#a4c6f2", "#7eabe8", "#5f96df", "#82b2ee")
        push_b, push_bh = "#8a8a8a", "#4f7fc0"
        tool_h, tool_p = push_h, push_p
        tool_b, tool_bh = clear("#8a8a8a"), "#8a8a8a"
        menu_bg = "#f6f6f6" if light else c["chrome"]
        menu_sel_bg = fill_css([(0, "#76adf3"), (1, "#2c6bd0")])
        list_sel = fill_css([(0, "#7db2f5"), (1, "#3d7de0")])
        menubar_bg = [(0, "#f4f4f4"), (1, "#dcdcdc")] if light else c["chrome"]
        toolbar_bg = [(0, "#ececec"), (1, "#c9c9c9")] if light else c["chrome"]
        status_bg = toolbar_bg
        extra += f"""
QMenuBar::item:selected {{ background: {menu_sel_bg}; color: #ffffff; }}
QMenu {{ border: 1px solid #8a8a8a; border-radius: 0; padding: 4px 0; }}
QMenu::item {{ border-radius: 0; margin: 0; }}
QMenu::item:selected {{ color: #ffffff; }}
QPushButton {{ border-radius: 11px; min-height: 18px; }}
QPushButton:default {{ border: 1px solid #3868b8; color: #ffffff;
    background: {fill_css(gel('#bcdcff', '#78b0f6', '#3f86e6', '#6aa8f4'))}; }}
QPushButton:default:hover {{ background: {fill_css(gel('#cde5ff', '#8cbcf8', '#5195ec', '#7cb6f6'))}; }}
QToolButton {{ border-radius: 4px; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ border: 1px solid #7a7a7a; border-top-color: #5c5c5c; border-radius: 3px; }}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ border: 2px solid #6aa4ea; }}
QScrollBar::handle:vertical {{ background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #b9d6fa,stop:.5 #5f9be8,stop:1 #3b78d0); border: 1px solid #3868b8; border-radius: 7px; }}
QScrollBar::handle:horizontal {{ background: {fill_css(gel('#b9d6fa', '#7aaef0', '#4a88dc', '#6ea6ee'))}; border: 1px solid #3868b8; border-radius: 7px; }}
QSlider::handle:horizontal {{ background: {fill_css(gel('#ffffff', '#e8e8e8', '#cfcfcf', '#ececec'))}; border: 1px solid #7a7a7a; width: 14px; height: 14px; margin: -6px 0; border-radius: 8px; }}
"""
        if light:   # the Aqua pinstripe on dialogs
            from PySide6.QtGui import QImage
            pin = _asset_dir() / "aqua-pin.png"
            img = QImage(2, 4, QImage.Format.Format_RGB32)
            for y in range(4):
                for x in range(2):
                    img.setPixelColor(x, y, QColor("#eaeaea" if y < 2 else "#f4f4f4"))
            img.save(str(pin))
            extra += f"QDialog {{ background-image: url({pin.as_posix()}); }}\n"
    elif kind == "glass":
        # macOS Tahoe 'Liquid Glass': frosted translucent capsules with bright inner rims
        rim = "#ffffff" if light else mix(c["chrome"], "#ffffff", .22)
        if light:
            push = [(0, "#ffffff"), (1, "#eef2f9")]
            push_h = [(0, "#ffffff"), (1, "#e3ecf9")]
            push_p = [(0, "#d6e3f5"), (1, "#c8d9f0")]
            push_b = push_bh = mix("#ffffff", c["border"], .7)
            menubar_bg = toolbar_bg = [(0, "#f7f9fd"), (1, "#eaeff7")]
            status_bg = menubar_bg
            menu_bg = "#fafbfe"
        else:
            push = [(0, mix(field, "#ffffff", .10)), (1, field)]
            push_h = [(0, mix(c["hover"], "#ffffff", .10)), (1, c["hover"])]
            push_p = mix(c["hover"], acc, .35)
            push_b = push_bh = mix(c["chrome"], "#ffffff", .20)
            menubar_bg = toolbar_bg = [(0, mix(c["chrome"], "#ffffff", .05)), (1, c["chrome"])]
            status_bg = menubar_bg
            menu_bg = mix(c["chrome"], "#ffffff", .04)
        pill = "rgba(255,255,255,150)" if light else "rgba(255,255,255,26)"
        pill_h = "rgba(255,255,255,215)" if light else "rgba(255,255,255,48)"
        pill_b = "rgba(255,255,255,200)" if light else "rgba(255,255,255,40)"
        tool_h = mix(c["chrome"], acc, .16 if light else .24)
        tool_p = mix(c["chrome"], acc, .30)
        menu_sel_bg = acc
        list_sel = mix(c["chrome"], acc, .22)
        extra += f"""
QMenuBar::item {{ border-radius: 12px; margin: 3px 1px; }}
QMenuBar::item:selected {{ background: {tool_h}; }}
{f"""QMenu {{ background: transparent; }}
#Popup, #Floating, #FindBar, #ImageBar, #Dock {{ background: transparent; }}
#Dock {{ border: none; border-radius: 26px; padding: 4px 8px; spacing: 2px; }}
#Dock QToolButton {{ background: {pill}; border: 1px solid {pill_b}; border-radius: 17px; padding: 3px 4px; min-height: 26px; min-width: 26px; }}
#Dock QToolButton:hover {{ background: {pill_h}; }}
#Dock QToolButton:checked {{ background: {mix(c['chrome'], acc, .35)}; color: {'#ffffff' if not light else c['text']}; }}
#Dock QToolButton:pressed {{ background: {fill_css(tool_p)}; }}
#Dock QComboBox {{ background: {pill}; border: 1px solid {pill_b}; border-radius: 17px; padding: 3px 12px; min-height: 26px; }}
#Dock QToolBar::separator, #Dock::separator {{ background: transparent; width: 6px; }}
QPushButton {{ background: {fill_css(clear(push, 190 if light else 170))}; }}""" if translucent_on else ""}
QMenu {{ border: 1px solid {mix(menu_bg, c['text'], .12)}; border-radius: 18px; padding: 8px; }}
QMenu::item {{ border-radius: 12px; margin: 1px 0; }}
QMenu::item:selected {{ color: #ffffff; }}
QPushButton {{ border-radius: 15px; border-top-color: {rim}; }}
QPushButton:default {{ border-color: {mix(acc, '#000000', .1)}; background: {fill_css([(0, mix(acc, '#ffffff', .25)), (1, acc)])}; color: #ffffff; }}
QToolButton {{ border-radius: 10px; }}
QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox {{ border-radius: 14px; border: 1px solid {mix(c['bg'], c['text'], .12)}; }}
QComboBox:focus, QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ border: 2px solid {acc}; }}
#Popup, #Floating, #FindBar, #ImageBar {{ border: 1px solid {mix(menu_bg, c['text'], .12)}; border-radius: 18px; }}
#Card {{ border-radius: 18px; }}
"""

    sel_color = menu_sel_fg if kind in ("xp", "classic", "term", "aqua", "glass") else c["text"]
    menu_sel_css, list_sel_css = menu_sel_bg, list_sel
    list_sel_fg = "#ffffff" if (kind in ("xp", "classic", "aqua") or (kind == "yaru")) else c["text"]
    box_css = f"width: {cb_size}px; height: {cb_size}px; border-radius: {cbr}px; border: 1.5px solid {cb_border}; background: {box_bg};"
    focus = (f"border: 1px solid {fb}; border-bottom: 2px solid {acc};" if m["focus_bottom"]
             else f"border-color: {acc};")

    qss = f"""
QMainWindow, QDialog {{ background: {fill_css(window_bg) if not isinstance(window_bg, str) else window_bg}; }}
QToolTip {{ background: {field}; color: {c['text']}; border: 1px solid {line}; padding: 4px 6px; }}

QMenuBar {{ background: {fill_css(menubar_bg)}; color: {c['text']}; padding: 2px 6px; border-bottom: 1px solid {c['border']}; }}
QMenuBar::item {{ background: transparent; padding: 5px 10px; border-radius: {menu_r}px; }}
QMenuBar::item:selected {{ background: {c['hover'] if kind != 'aero' else fill_css(tool_h)}; }}
QMenu {{ background: {menu_bg}; border: 1px solid {line}; padding: 5px; }}
QMenu::item {{ padding: 6px 28px 6px 28px; border-radius: {menu_r}px; }}
QMenu::item:selected {{ background: {menu_sel_css}; color: {sel_color}; }}
QMenu::item:disabled {{ color: {dis}; }}
QMenu::separator {{ height: 1px; background: {c['border']}; margin: 5px 8px; }}
QMenu::indicator {{ width: 14px; height: 14px; left: 7px; }}
QMenu::indicator:non-exclusive:checked, QMenu::indicator:exclusive:checked {{ image: url({a['check']}); background: {acc}; border-radius: {min(cbr, 4)}px; }}

QToolBar {{ background: {fill_css(toolbar_bg)}; border: none; border-bottom: 1px solid {c['border']};
           padding: 6px 10px; spacing: 3px; }}
QToolBar::separator {{ width: 1px; background: {c['border']}; margin: 4px 7px; }}
QToolButton {{ background: {fill_css(clear(tool_h))}; border: 1px solid {col_css(Q(tool_b))}; border-radius: {r}px; padding: {pad};
              color: {c['text']}; min-width: 18px; }}
QToolButton:hover {{ background: {fill_css(tool_h)}; border-color: {col_css(Q(tool_bh))}; }}
QToolButton:checked {{ background: {checked}; color: {c['text']}; border-color: {mix(checked, acc, 0.5)}; }}
QToolButton:pressed {{ background: {fill_css(tool_p)}; }}
QToolButton:disabled {{ color: {dis}; }}
QToolButton::menu-indicator {{ image: none; }}

QComboBox {{ background: {fill_css(push)}; border: 1px solid {fb}; border-radius: {r}px;
            padding: 4px 8px; color: {c['text']}; min-height: 20px; }}
QComboBox:hover {{ border-color: {mix(fb if fb != 'transparent' else c['hover'], acc, 0.4)}; background: {fill_css(push_h)}; }}
QComboBox:focus, QComboBox:on {{ border-color: {acc}; }}
QComboBox::drop-down {{ border: none; width: 20px; }}
QComboBox::down-arrow {{ image: url({a['arrow']}); width: 12px; height: 12px; }}
QComboBox QAbstractItemView {{ background: {menu_bg}; border: 1px solid {line}; outline: 0;
    selection-background-color: {c['hover']}; selection-color: {c['text']}; padding: 4px; }}
QLineEdit, QSpinBox, QDoubleSpinBox {{ background: {field_bg}; border: 1px solid {fb}; border-radius: {r}px;
    padding: 4px 8px; selection-background-color: {c['selection']}; selection-color: {sel_text}; }}
QSpinBox, QDoubleSpinBox {{ padding: 4px 26px 4px 8px; min-height: 20px; }}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{ {focus} }}
QSpinBox::up-button, QDoubleSpinBox::up-button {{ subcontrol-origin: border; subcontrol-position: top right; width: 22px;
    border: none; border-left: 1px solid {c['border']}; border-top-right-radius: {max(r - 1, 0)}px; background: transparent; }}
QSpinBox::down-button, QDoubleSpinBox::down-button {{ subcontrol-origin: border; subcontrol-position: bottom right; width: 22px;
    border: none; border-left: 1px solid {c['border']}; border-bottom-right-radius: {max(r - 1, 0)}px; background: transparent; }}
QSpinBox::up-button:hover, QDoubleSpinBox::up-button:hover, QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover {{ background: {c['hover']}; }}
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow {{ image: url({a['up']}); width: 10px; height: 10px; }}
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow {{ image: url({a['down']}); width: 10px; height: 10px; }}

QPushButton {{ background: {fill_css(push)}; border: 1px solid {col_css(Q(push_b))}; border-radius: {r}px; padding: {m['btn_pad']}; }}
QPushButton:hover {{ background: {fill_css(push_h)}; border-color: {col_css(Q(push_bh))}; }}
QPushButton:pressed {{ background: {fill_css(push_p)}; }}
QPushButton:default {{ background: {acc}; border-color: {acc}; color: {on_accent}; }}
QPushButton:checked {{ background: {checked}; }}

QCheckBox, QRadioButton {{ spacing: 9px; }}
QCheckBox::indicator {{ {box_css} }}
QCheckBox::indicator:hover, QRadioButton::indicator:hover {{ border-color: {acc}; }}
QCheckBox::indicator:checked {{ image: url({cb_img}); background: {cb_checked_bg}; border-color: {cb_checked_border}; }}
QCheckBox::indicator:disabled {{ border-color: {dis}; }}
QRadioButton::indicator {{ width: {cb_size}px; height: {cb_size}px; border-radius: {cb_size // 2 + 1}px; border: 1.5px solid {cb_border}; background: {box_bg}; }}
QRadioButton::indicator:checked {{ image: url({rb_img}); background: {cb_checked_bg}; border-color: {cb_checked_border}; }}
QTableView::indicator, QListView::indicator {{ {box_css} }}
QTableView::indicator:checked, QListView::indicator:checked {{ image: url({cb_img}); background: {cb_checked_bg}; border-color: {cb_checked_border}; }}
QGroupBox {{ border: 1px solid {c['border']}; border-radius: {rp}px; margin-top: 14px; padding: 12px 10px 8px 10px; }}
QGroupBox::title {{ subcontrol-origin: margin; left: 12px; padding: 0 5px; color: {c['muted']}; }}

QTextEdit, QPlainTextEdit {{ background: {c['bg']}; color: {c['text']}; border: none; selection-background-color: {c['selection']}; selection-color: {sel_text}; }}
#MdView {{ font-family: 'JetBrains Mono', 'Hack', 'IBM Plex Mono', 'Noto Sans Mono', 'DejaVu Sans Mono', monospace; font-size: 11pt; padding: 8px; }}

QStatusBar {{ background: {fill_css(status_bg)}; color: {c['muted']}; border-top: 1px solid {c['border']}; }}
QStatusBar::item {{ border: none; }}
QLabel {{ background: transparent; }}

QListWidget {{ background: transparent; border: none; outline: 0; }}
QListWidget::item {{ padding: 7px 10px; border-radius: {r}px; color: {c['text']}; border: 1px solid transparent; }}
QListWidget::item:hover {{ background: {c['hover']}; }}
QListWidget::item:selected {{ background: {list_sel_css}; color: {list_sel_fg}; border-color: {'#7da2ce' if kind == 'aero' and light else 'transparent'}; }}
QTableWidget {{ background: {c['bg']}; border: 1px solid {c['border']}; gridline-color: {c['border']}; border-radius: {r}px; }}
QHeaderView::section {{ background: {c['chrome']}; color: {c['muted']}; border: none; padding: 5px; }}

QScrollBar:vertical {{ background: {track}; width: {m['scroll']}px; margin: 0; }}
QScrollBar::handle:vertical {{ background: {handle_v}; border: {handle_b}; border-radius: {m['handle_r']}px; min-height: 36px; margin: 2px 3px; }}
QScrollBar::handle:vertical:hover {{ background: {handle_hv}; }}
QScrollBar:horizontal {{ background: {track}; height: {m['scroll']}px; margin: 0; }}
QScrollBar::handle:horizontal {{ background: {handle_h}; border: {handle_b}; border-radius: {m['handle_r']}px; min-width: 36px; margin: 3px 2px; }}
QScrollBar::handle:horizontal:hover {{ background: {handle_hv}; }}
QScrollBar::add-line, QScrollBar::sub-line {{ width: 0; height: 0; }}
QScrollBar::add-page, QScrollBar::sub-page {{ background: transparent; }}

QSlider::groove:horizontal {{ height: 4px; background: {c['hover']}; border-radius: 2px; }}
QSlider::sub-page:horizontal {{ background: {acc}; border-radius: 2px; }}
QSlider::handle:horizontal {{ background: {c['text']}; width: 14px; height: 14px; margin: -5px 0; border-radius: 7px; }}

#Popup, #Floating, #FindBar, #ImageBar {{ background: {menu_bg}; border: 1px solid {mix(c['border'], c['text'], 0.1)}; border-radius: {rp}px; }}
#Popup QLabel, #Floating QLabel#Muted {{ color: {c['muted']}; }}
#Floating QLabel#Head {{ color: {c['muted']}; font-size: 8pt; font-weight: 600; letter-spacing: 1px; padding: 2px 6px; }}
#Emoji {{ font-family: 'Noto Color Emoji'; font-size: 18px; padding: 3px; }}
#Sidebar {{ background: {c['bg']}; border-right: 1px solid {c['border']}; }}
#Banner {{ background: {mix(c['chrome'], acc, 0.15)}; color: {c['text']}; padding: 7px 14px; border-bottom: 1px solid {c['border']}; }}

#Dash {{ background: {c['bg']}; }}
#Dash QLabel#Title {{ font-size: 26pt; font-weight: 700; }}
#Dash QLabel#Sub {{ color: {c['muted']}; }}
#Dash QLabel#Section {{ color: {c['muted']}; font-size: 9pt; font-weight: 600; letter-spacing: 1px; }}
#Card {{ background: {fill_css(card)}; border: 1px solid {card_b}; border-radius: {rp}px; }}
#Card:hover {{ border-color: {card_bh}; background: {fill_css(card_h)}; }}
#Card QLabel#Name {{ font-weight: 600; font-size: 11pt; }}
#Card QLabel#Path, #Card QLabel#Snippet {{ color: {c['muted']}; }}
{extra}"""
    from . import titlebar
    tb = titlebar.spec_for(kind, c, light, acc, on_accent)
    inline = tb["inline_menu"] and tb["layout"] == "win"
    qss += f"""
#TopBar {{ background: {fill_css(menubar_bg)}; }}
#TopBar[custom="true"] {{ background: {fill_css(tb['bg'])}; }}
#TopBar[custom="true"] QMenuBar {{ {'background: transparent; border: none;' if inline else ''} }}
#TopBar QLabel#TitleText {{ background: transparent; }}
"""
    spec = dict(ms=m["ms"], fade=m["fade"], r=r, ease=m["ease"], titlebar=tb,
                push=(push, push_h, push_b, push_bh, push_bb, push_bbh),
                push_default=(*default_fill, None, None),
                tool=(clear(tool_h), tool_h, tool_b, tool_bh, None, None),
                card=(card, card_h, card_b, card_bh, None, None))
    return qss, spec
