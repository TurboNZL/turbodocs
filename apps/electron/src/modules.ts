import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TurboDocs is a shell plus app modules (Docs, Sheets, Slides). A module is installed or removed from Settings > Apps, and opens the file
 * types it declares, wherever the file comes from: Open, a drag onto the window, or the system ("Open with TurboDocs", the command line).
 * `available: false` = the module is on the roadmap and has no code yet (it cannot be installed).
 */
export interface AppModule {
  id: string;
  title: string;
  description: string;
  /** lower-case, with the dot */
  extensions: string[];
  available: boolean;
  /** installed until the user removes it */
  defaultInstalled: boolean;
}

export const MODULES: AppModule[] = [
  { id: 'docs', title: 'Docs', description: 'Word documents, Markdown and text.', extensions: ['.docx', '.md', '.markdown', '.txt'], available: true, defaultInstalled: true },
  { id: 'sheets', title: 'Sheets', description: 'Excel workbooks and CSV.', extensions: ['.xlsx', '.csv'], available: false, defaultInstalled: false },
  { id: 'slides', title: 'Slides', description: 'PowerPoint presentations.', extensions: ['.pptx'], available: false, defaultInstalled: false },
];

export const isInstalled = (m: AppModule, saved: Record<string, boolean>) => m.available && (saved[m.id] ?? m.defaultInstalled);

/** The module that opens this file, whether or not it is installed. */
export const moduleFor = (path: string): AppModule | undefined => MODULES.find((m) => m.extensions.includes(extname(path).toLowerCase()));

/**
 * A launcher argument as a path. The desktop file says `%U`, so a file manager may hand over `file:///home/a/My%20doc.docx` instead of a
 * plain path; both mean the same file. Anything else (flags, other URLs) is not a file.
 */
export function argToPath(arg: string): string | null {
  if (arg.startsWith('-')) return null;
  if (/^file:\/\//i.test(arg)) { try { return fileURLToPath(arg); } catch { return null; } }
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(arg) ? null : arg;
}

/** Files named on a command line (Linux/Windows "Open with"), ignoring flags and the program itself. */
export function filesFromArgv(argv: string[], packaged: boolean): string[] {
  return argv.slice(packaged ? 1 : 2).map(argToPath).filter((p): p is string => !!p && !!moduleFor(p));
}
