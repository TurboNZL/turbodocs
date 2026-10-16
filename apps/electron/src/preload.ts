import { contextBridge, ipcRenderer } from 'electron';

/** What the web client may know about the desktop app (and the few things only the main process can do). */
const info = ipcRenderer.sendSync('turbodocs:info') as { version: string; platform: string; desktopEnv: string; port: number; customFrame: boolean };

contextBridge.exposeInMainWorld('turbodocsDesktop', {
  ...info,
  modules: () => ipcRenderer.invoke('turbodocs:modules') as Promise<unknown>,
  setModule: (id: string, on: boolean) => ipcRenderer.invoke('turbodocs:module-set', id, on) as Promise<unknown>,
  openDialog: () => ipcRenderer.invoke('turbodocs:open-dialog') as Promise<unknown>,
  readFile: (path: string) => ipcRenderer.invoke('turbodocs:read-file', path) as Promise<Uint8Array>,
  writeFile: (path: string, bytes: Uint8Array | string) => ipcRenderer.invoke('turbodocs:write-file', path, bytes) as Promise<void>,
  saveDialog: (suggested: string) => ipcRenderer.invoke('turbodocs:save-dialog', suggested) as Promise<string | null>,
  setDirty: (on: boolean) => ipcRenderer.send('turbodocs:set-dirty', on),
  recent: () => ipcRenderer.invoke('turbodocs:recent') as Promise<unknown>,
  openRecent: (path: string) => ipcRenderer.invoke('turbodocs:recent-open', path) as Promise<unknown>,
  clearRecent: () => ipcRenderer.invoke('turbodocs:recent-clear') as Promise<void>,
  defaultApps: () => ipcRenderer.invoke('turbodocs:default-apps') as Promise<unknown>,
  setDefaultApps: (mimes: string[]) => ipcRenderer.invoke('turbodocs:default-apps-set', mimes) as Promise<unknown>,
  takePending: () => ipcRenderer.invoke('turbodocs:take-pending') as Promise<unknown>,
  onOpen: (cb: (r: unknown) => void) => { const h = (_e: unknown, r: unknown) => cb(r); ipcRenderer.on('turbodocs:open', h); return () => { ipcRenderer.removeListener('turbodocs:open', h); }; },
  updates: {
    state: () => ipcRenderer.invoke('turbodocs:update-state') as Promise<unknown>,
    hasToken: () => ipcRenderer.invoke('turbodocs:update-has-token') as Promise<boolean>,
    setToken: (t: string) => ipcRenderer.invoke('turbodocs:update-set-token', t) as Promise<void>,
    check: () => ipcRenderer.invoke('turbodocs:update-check') as Promise<unknown>,
    install: () => ipcRenderer.send('turbodocs:update-install'),
    onState: (cb: (s: unknown) => void) => { const h = (_e: unknown, s: unknown) => cb(s); ipcRenderer.on('turbodocs:update', h); return () => { ipcRenderer.removeListener('turbodocs:update', h); }; },
  },
  getGpu: () => ipcRenderer.invoke('turbodocs:gpu-get') as Promise<unknown>,
  gpuReport: () => ipcRenderer.invoke('turbodocs:gpu-report') as Promise<string>,
  openGpuPage: () => ipcRenderer.send('turbodocs:gpu-page'),
  setGpu: (mode: string) => ipcRenderer.invoke('turbodocs:gpu-set', mode) as Promise<void>,
  getGraphics: () => ipcRenderer.invoke('turbodocs:graphics') as Promise<unknown>,
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('turbodocs:window', action),
  setCustomFrame: (on: boolean) => ipcRenderer.invoke('turbodocs:set-frame', on) as Promise<void>,
  onWindowState: (cb: (maximized: boolean) => void) => { const h = (_e: unknown, m: boolean) => cb(m); ipcRenderer.on('turbodocs:window-state', h); return () => { ipcRenderer.removeListener('turbodocs:window-state', h); }; },
});
