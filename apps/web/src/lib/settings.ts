/** What the desktop app (apps/electron/src/preload.ts) puts on `window`. Missing in a plain browser (`pnpm dev`). */
export interface ModuleInfo { id: string; title: string; description: string; extensions: string[]; available: boolean; installed: boolean }
/** A file somebody asked us to open: the module that handles its type, and whether that module is installed. */
export interface OpenRequest { path: string; module: string | null; installed: boolean }
/** Which file types TurboDocs is the default application for (Linux; elsewhere the system's own settings, `reason` says where) */
export interface DefaultApps { supported: boolean; reason?: string; desktopId: string; rows: { ext: string; mime: string; module: string; isDefault: boolean }[] }
/** One card of the dashboard's recent documents */
export interface RecentDoc { path: string; at: number; mtime: number; snippet: string }
export interface GpuInfo { mode: string; auto: { step: number; done: boolean }; running: string; modes: { id: string; label: string; hint: string }[] }

export interface TurboDocsDesktop {
  version: string; platform: string; desktopEnv: string; port: number; customFrame: boolean;
  modules(): Promise<ModuleInfo[]>;
  setModule(id: string, on: boolean): Promise<ModuleInfo[]>;
  openDialog(dir?: string): Promise<OpenRequest[]>;
  takePending(): Promise<OpenRequest[]>;
  defaultApps(): Promise<DefaultApps>;
  setDefaultApps(mimes: string[]): Promise<DefaultApps>;
  recent(): Promise<RecentDoc[]>;
  /** opens a file from the recent list (it is allowed again for reading and saving) */
  openRecent(path: string): Promise<OpenRequest>;
  clearRecent(): Promise<void>;
  /** replaces a file that was opened or chosen with Save as (the old one is copied to the app's backups first); text is saved as UTF-8 */
  writeFile(path: string, bytes: Uint8Array | string): Promise<void>;
  /** the Save as dialog; null when cancelled */
  saveDialog(suggestedName: string, dir?: string): Promise<string | null>;
  /** cut / copy / paste / pasteAndMatchStyle / selectAll on the focused page, through the system clipboard */
  editCommand(name: 'cut' | 'copy' | 'paste' | 'pasteAndMatchStyle' | 'selectAll'): void;
  /** crash backups: a copy of the unsaved document, kept beside the real file (key = its path, or `new:<id>`) */
  autosaveWrite(key: string, bytes: Uint8Array | string): Promise<void>;
  autosaveRead(key: string): Promise<{ at: number; bytes: Uint8Array } | null>;
  autosaveClear(key: string): Promise<void>;
  /** tells the window whether there are unsaved changes (closing then asks first) */
  setDirty(on: boolean): void;
  /** the bytes of a file that was opened through TurboDocs (the main process refuses any other path) */
  readFile(path: string): Promise<Uint8Array>;
  onOpen(cb: (r: OpenRequest) => void): () => void;
  updates: import('./native.ts').NativeUpdates;
  getGpu?(): Promise<GpuInfo>; gpuReport?(): Promise<string>; openGpuPage?(): void; setGpu?(mode: string): Promise<void>;
  getGraphics?(): Promise<{ hardware: boolean; summary: string; detail: string }>;
  windowControl?(action: 'minimize' | 'maximize' | 'close' | 'fullscreen'): void;
  setCustomFrame?(on: boolean): Promise<void>;
  onWindowState?(cb: (maximized: boolean) => void): () => void;
}

export const desktop = (): TurboDocsDesktop | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { turbodocsDesktop?: TurboDocsDesktop }).turbodocsDesktop);
