/** What the desktop app (apps/electron/src/preload.ts) puts on `window`. Missing in a plain browser (`pnpm dev`). */
export interface ModuleInfo { id: string; title: string; description: string; extensions: string[]; available: boolean; installed: boolean }
/** A file somebody asked us to open: the module that handles its type, and whether that module is installed. */
export interface OpenRequest { path: string; module: string | null; installed: boolean }
export interface GpuInfo { mode: string; auto: { step: number; done: boolean }; running: string; modes: { id: string; label: string; hint: string }[] }

export interface TurboDocsDesktop {
  version: string; platform: string; desktopEnv: string; port: number; customFrame: boolean;
  modules(): Promise<ModuleInfo[]>;
  setModule(id: string, on: boolean): Promise<ModuleInfo[]>;
  openDialog(): Promise<OpenRequest[]>;
  takePending(): Promise<OpenRequest[]>;
  /** replaces a file that was opened or chosen with Save as (the old one is copied to the app's backups first); text is saved as UTF-8 */
  writeFile(path: string, bytes: Uint8Array | string): Promise<void>;
  /** the Save as dialog; null when cancelled */
  saveDialog(suggestedName: string): Promise<string | null>;
  /** tells the window whether there are unsaved changes (closing then asks first) */
  setDirty(on: boolean): void;
  /** the bytes of a file that was opened through TurboDocs (the main process refuses any other path) */
  readFile(path: string): Promise<Uint8Array>;
  onOpen(cb: (r: OpenRequest) => void): () => void;
  updates: import('./native.ts').NativeUpdates;
  getGpu?(): Promise<GpuInfo>; gpuReport?(): Promise<string>; openGpuPage?(): void; setGpu?(mode: string): Promise<void>;
  getGraphics?(): Promise<{ hardware: boolean; summary: string; detail: string }>;
  windowControl?(action: 'minimize' | 'maximize' | 'close'): void;
  setCustomFrame?(on: boolean): Promise<void>;
  onWindowState?(cb: (maximized: boolean) => void): () => void;
}

export const desktop = (): TurboDocsDesktop | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { turbodocsDesktop?: TurboDocsDesktop }).turbodocsDesktop);
