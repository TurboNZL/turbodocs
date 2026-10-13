/** The fonts offered in the toolbar. A document names a font ("Calibri"); we draw it with metric-compatible stand-ins where the system lacks it. */
const STACKS: Record<string, string> = {
  Calibri: 'Calibri, Carlito, "Source Sans 3", sans-serif',
  Cambria: 'Cambria, Caladea, Georgia, serif',
  Arial: 'Arial, "Liberation Sans", Arimo, Helvetica, sans-serif',
  'Times New Roman': '"Times New Roman", "Liberation Serif", Tinos, serif',
  Georgia: 'Georgia, serif',
  Verdana: 'Verdana, "DejaVu Sans", sans-serif',
  'Courier New': '"Courier New", "Liberation Mono", Cousine, monospace',
  Consolas: 'Consolas, "DejaVu Sans Mono", monospace',
  Inter: 'Inter, sans-serif', 'Open Sans': '"Open Sans", sans-serif', Roboto: 'Roboto, sans-serif', Nunito: 'Nunito, sans-serif', Ubuntu: 'Ubuntu, sans-serif',
};
export const FONT_CHOICES = Object.keys(STACKS);
export const DEFAULT_FONT = 'Calibri';
export const DEFAULT_STACK = STACKS.Calibri;
export const fontStack = (name: string) => STACKS[name] ?? `"${name.replace(/"/g, '')}", ${DEFAULT_STACK}`;
/** "Calibri, Carlito, sans-serif" or '"Calibri"' -> Calibri */
export const plainFont = (css: string): string | null => { const f = css.split(',')[0]?.replace(/["']/g, '').trim(); return f || null; };
export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
export const COLOURS = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff', '#e06c75', '#d9480f', '#f59f00', '#fff176', '#2f9e44', '#12b886', '#1c7ed6', '#1864ab', '#7048e8', '#be4bdb', '#e64980', '#a5d8ff', '#b2f2bb', '#ffc9c9'];
