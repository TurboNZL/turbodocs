import { extname } from 'node:path';

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
  { id: 'docs', title: 'Docs', description: 'Word documents, Markdown and text.', extensions: ['.docx', '.md', '.markdown', '.txt'], available: false, defaultInstalled: true },
  { id: 'sheets', title: 'Sheets', description: 'Excel workbooks and CSV.', extensions: ['.xlsx', '.csv'], available: false, defaultInstalled: false },
  { id: 'slides', title: 'Slides', description: 'PowerPoint presentations.', extensions: ['.pptx'], available: false, defaultInstalled: false },
];

export const isInstalled = (m: AppModule, saved: Record<string, boolean>) => m.available && (saved[m.id] ?? m.defaultInstalled);

/** The module that opens this file, whether or not it is installed. */
export const moduleFor = (path: string): AppModule | undefined => MODULES.find((m) => m.extensions.includes(extname(path).toLowerCase()));

/** Files named on a command line (Linux/Windows "Open with"), ignoring flags and the program itself. */
export function filesFromArgv(argv: string[], packaged: boolean): string[] {
  return argv.slice(packaged ? 1 : 2).filter((a) => !a.startsWith('-') && !!moduleFor(a));
}
