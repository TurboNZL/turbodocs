import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { findWebDir, loadDesktopConfig, loadRecent, loadUpdateToken, saveDesktopConfig, saveRecent, saveUpdateToken } from './desktopConfig.ts';
import { startStaticServer } from './staticServer.ts';
import { filesFromArgv, isInstalled, MIME_TYPES, mimeRows, MODULES, moduleFor } from './modules.ts';
import { queryDefaults, setDefaults } from './defaultApps.ts';
import { Updates } from './updater.ts';
import { existingFile, pushRecent, snippetOf, type Recent } from './recent.ts';
import { describeGraphics, type Graphics } from './graphics.ts';
import { activeMode, GPU_MODES, nextAutoStep } from './gpuModes.ts';

/**
 * The window shows the built web client from a tiny local server on 127.0.0.1 (a fixed port, so the window's storage, which holds the
 * chosen theme, is the same on every launch). The window chrome, updates and graphics start-up are the engine's window-frame and
 * updaters modules; what is TurboDocs' own is the module registry (modules.ts) and the file-open plumbing below.
 */
const here = dirname(fileURLToPath(import.meta.url));
let server: { port: number; close(): Promise<void> } | null = null;
let win: BrowserWindow | null = null;
const updates = new Updates(app.isPackaged, (state) => win?.webContents.send('turbodocs:update', state));

// the desktop file's name is the window's identity on Wayland (its app id): without this the launcher's icon and the window do not match
if (process.platform === 'linux') app.setDesktopName('turbodocs.desktop');

// A second launch hands its arguments to the running app (second-instance below) and exits. app.quit() is asynchronous, so startup must
// not go on in the meantime: it would find the port taken and open an error dialog nobody can dismiss.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

/** Files the system asked us to open before the window was ready to hear about it. */
const pending: string[] = [];
/**
 * The only files the page may read: ones that arrived through Open, the command line or the system. The page is ordinary web content, so it
 * must not be able to ask for any path on the disk.
 */
const allowed = new Set<string>();
const MAX_FILE = 200 * 1024 * 1024;
const rememberRecent = (path: string) => { try { saveRecent(userData(), pushRecent(loadRecent(userData()), resolve(path), Date.now())); } catch { /* the list is a convenience */ } };
const openRequest = (path: string) => {
  const m = moduleFor(path);
  if (m) { allowed.add(resolve(path)); rememberRecent(path); }
  const desk = loadDesktopConfig(userData());
  return { path, module: m?.id ?? null, installed: m ? isInstalled(m, desk.modules) : false };
};
function openFiles(paths: string[]) {
  const ready = !!win && !win.webContents.isLoading();
  for (const p of paths) { if (ready) win!.webContents.send('turbodocs:open', openRequest(p)); else pending.push(p); }
}
app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  openFiles(filesFromArgv(argv, app.isPackaged));
});
app.on('open-file', (e, path) => { e.preventDefault(); openFiles([path]); }); // macOS
pending.push(...filesFromArgv(process.argv, app.isPackaged));

const gpuChoice = loadDesktopConfig(app.getPath('userData'));
const gpuStart = activeMode(gpuChoice.gpuMode === 'auto' && gpuChoice.gpuAuto.done ? { mode: 'auto', auto: { step: gpuChoice.gpuAuto.step, done: true } } : { mode: gpuChoice.gpuMode, auto: gpuChoice.gpuAuto }, process.env.XDG_SESSION_TYPE);
if (process.platform === 'linux') {
  // Chromium's block list leaves GPU painting off on many Linux drivers: ask for it. A driver that really cannot do it still falls back by
  // itself, graphics() below reports what happened, and "Automatic" then tries the next way to start the graphics (see gpuModes.ts).
  if (gpuStart.features?.length) app.commandLine.appendSwitch('enable-features', gpuStart.features.join(','));
  // Chromium on Wayland cannot use Vulkan; the modes name their own ANGLE back end. Vulkan stays off except in the one mode that asks for it.
  if (!gpuStart.features?.includes('Vulkan')) app.commandLine.appendSwitch('disable-features', 'Vulkan');
  if (gpuStart.software) app.disableHardwareAcceleration();
  else for (const [name, value] of gpuStart.switches) app.commandLine.appendSwitch(name, value);
}
// escape hatch for a driver that crashes the GPU process: TURBODOCS_SOFTWARE_RENDERING=1 pnpm start
if (process.env.TURBODOCS_SOFTWARE_RENDERING) app.disableHardwareAcceleration();
let gpuCrashes = 0;
app.on('child-process-gone', (_e, d) => { if (d.type === 'GPU') { gpuCrashes++; console.warn(`[turbodocs] the GPU process stopped (${d.reason}, code ${d.exitCode}); crash ${gpuCrashes}`); } });

async function graphics(): Promise<Graphics> {
  const info = (await app.getGPUInfo('complete').catch(() => app.getGPUInfo('basic').catch(() => null))) as { auxAttributes?: { glRenderer?: string; glImplementationParts?: string }; gpuDevice?: { vendorId?: number }[] } | null;
  return describeGraphics({
    features: app.getGPUFeatureStatus() as unknown as Record<string, string>,
    renderer: info?.auxAttributes?.glRenderer ?? '',
    glParts: info?.auxAttributes?.glImplementationParts ?? '',
    vendorIds: (info?.gpuDevice ?? []).map((d) => d.vendorId ?? 0),
  }, gpuCrashes);
}

const userData = () => app.getPath('userData');

async function boot(): Promise<void> {
  const desk = loadDesktopConfig(userData());
  const webDir = findWebDir(process.resourcesPath, join(here, '../../web/dist'));
  if (!webDir) throw new Error('The web client has not been built. Run `pnpm --filter @turbodocs/web build` first.');
  try { server = await startStaticServer(webDir, desk.port); }
  catch (e) {
    throw new Error((e as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? `Port ${desk.port} is already in use. Close whatever uses it, or set TURBODOCS_DESKTOP_PORT to another port (the app remembers its settings per port).`
      : (e as Error).message);
  }
}

function openWindow() {
  const custom = loadDesktopConfig(userData()).customFrame;
  win = new BrowserWindow({
    frame: !custom, autoHideMenuBar: true,
    width: 1280, height: 840, minWidth: 420, minHeight: 520, backgroundColor: '#0b0b10', show: false, title: 'TurboDocs',
    // packaged: the file is shipped as a resource (it is not inside app.asar); in development it is in build/
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(here, '../build/icon.png'),
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win?.show());
  win.on('maximize', () => win?.webContents.send('turbodocs:window-state', true));
  win.on('unmaximize', () => win?.webContents.send('turbodocs:window-state', false));
  shortcuts(win);
  const origin = `http://127.0.0.1:${server!.port}`;
  // anything that is not this app opens in the user's browser instead of inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) { e.preventDefault(); if (/^https?:/.test(url)) void shell.openExternal(url); } });
  win.on('close', (e) => {
    if (!dirty) return;
    e.preventDefault();
    void dialog.showMessageBox(win!, { type: 'warning', buttons: ['Discard changes', 'Keep editing'], defaultId: 1, cancelId: 1, message: 'This document has unsaved changes.', detail: 'Closing now loses them.' })
      .then((r) => { if (r.response === 0) { dirty = false; win?.close(); } });
  });
  win.on('closed', () => { win = null; });
  // the page asks for the files that were waiting once it is listening (see lib/settings.ts onOpenFile)
  win.webContents.once('did-finish-load', () => setTimeout(() => void graphics().then((g) => console.log(`[turbodocs] graphics: ${g.summary}${g.hardware ? '' : '. If your computer has a GPU, see Settings > This app > Graphics start-up.'}`)), 2500));
  void win.loadURL(origin);
}

const moduleList = () => {
  const saved = loadDesktopConfig(userData()).modules;
  return MODULES.map((m) => ({ ...m, installed: isInstalled(m, saved) }));
};

ipcMain.on('turbodocs:info', (e) => {
  e.returnValue = { customFrame: loadDesktopConfig(userData()).customFrame, version: app.getVersion(), platform: process.platform, desktopEnv: process.env.XDG_CURRENT_DESKTOP ?? '', port: server?.port ?? 0 };
});
ipcMain.handle('turbodocs:modules', () => moduleList());
ipcMain.handle('turbodocs:module-set', (_e, id: unknown, on: unknown) => {
  const m = MODULES.find((x) => x.id === id);
  if (!m || typeof on !== 'boolean') return moduleList();
  if (!m.available) return moduleList(); // no code yet: nothing to install
  const saved = loadDesktopConfig(userData()).modules;
  saveDesktopConfig(userData(), { modules: { ...saved, [m.id]: on } });
  return moduleList();
});
ipcMain.handle('turbodocs:take-pending', () => pending.splice(0).map(openRequest));
ipcMain.handle('turbodocs:open-dialog', async () => {
  const r = await dialog.showOpenDialog(win ?? undefined!, {
    title: 'Open', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Documents', extensions: MODULES.flatMap((m) => m.extensions.map((x) => x.slice(1))) }, ...MODULES.map((m) => ({ name: m.title, extensions: m.extensions.map((x) => x.slice(1)) })), { name: 'All files', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths.map(openRequest);
});
ipcMain.handle('turbodocs:read-file', async (_e, path: unknown) => {
  if (typeof path !== 'string' || !allowed.has(resolve(path))) throw new Error('That file was not opened through TurboDocs.');
  const s = await stat(path);
  if (!s.isFile()) throw new Error('Not a file.');
  if (s.size > MAX_FILE) throw new Error(`The file is larger than ${MAX_FILE / 1024 / 1024} MB.`);
  return await readFile(path);
});
/**
 * Saving. The page may write only to a file that came through Open / the system / the Save dialog (the same list as reading), and only
 * to a type some module opens. The old file is copied to <userData>/backups before it is replaced, and the new one is written next to it and
 * renamed over it, so a crash in the middle never leaves a half-written document.
 */
const BACKUPS_KEPT = 60;
async function backupBeforeOverwrite(path: string) {
  if (!(await stat(path).then((s) => s.isFile(), () => false))) return;
  const dir = join(userData(), 'backups');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await copyFile(path, join(dir, `${stamp}-${basename(path)}`));
  const old = (await readdir(dir)).sort().slice(0, -BACKUPS_KEPT);
  await Promise.all(old.map((f) => unlink(join(dir, f)).catch(() => undefined)));
}
ipcMain.handle('turbodocs:write-file', async (_e, path: unknown, bytes: unknown) => {
  if (typeof path !== 'string' || !allowed.has(resolve(path))) throw new Error('That file was not opened or chosen through TurboDocs.');
  if (!moduleFor(path)) throw new Error('TurboDocs does not save this type of file.');
  const data = bytes instanceof Uint8Array ? bytes : typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : null;
  if (!data) throw new Error('Nothing to save.');
  if (data.length > MAX_FILE) throw new Error('The document is too large to save.');
  await backupBeforeOverwrite(path);
  rememberRecent(path);
  const tmp = `${path}.turbodocs-tmp`;
  try { await writeFile(tmp, data); await rename(tmp, path); } catch (e) { await unlink(tmp).catch(() => undefined); throw e; }
});
ipcMain.handle('turbodocs:save-dialog', async (_e, suggested: unknown) => {
  const name = typeof suggested === 'string' && suggested ? basename(suggested) : 'Untitled.docx';
  const ext = extname(name).slice(1) || 'docx';
  const r = await dialog.showSaveDialog(win ?? undefined!, { title: 'Save as', defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  const path = extname(r.filePath) ? r.filePath : `${r.filePath}.${ext}`;
  if (!moduleFor(path)) return null;
  allowed.add(resolve(path));
  return path;
});
/** The page tells us when the document has unsaved changes; closing the window then asks first. */
let dirty = false;
ipcMain.on('turbodocs:set-dirty', (_e, on: unknown) => { dirty = on === true; });
/** The dashboard's recent documents. Opening one goes through openRequest, so it enters the allow-list again after a restart. */
ipcMain.handle('turbodocs:recent', async () => {
  const kept: Recent[] = [];
  const cards = [];
  for (const r of loadRecent(userData())) {
    if (!(await existingFile(r.path))) continue;
    kept.push(r);
    cards.push({ path: r.path, at: r.at, mtime: (await stat(r.path)).mtimeMs, snippet: await snippetOf(r.path) });
  }
  if (kept.length !== loadRecent(userData()).length) saveRecent(userData(), kept);
  return cards;
});
ipcMain.handle('turbodocs:recent-open', (_e, path: unknown) => {
  if (typeof path !== 'string' || !loadRecent(userData()).some((r) => r.path === path)) throw new Error('That file is not in the recent list.');
  return openRequest(path);
});
ipcMain.handle('turbodocs:recent-clear', () => saveRecent(userData(), []));
/** Default applications (Linux: xdg-mime). Only the types of installed modules are offered; the desktop file is the one the installer made. */
const DESKTOP_ID = 'turbodocs.desktop';
const installedRows = () => { const saved = loadDesktopConfig(userData()).modules; return mimeRows(MODULES.filter((m) => isInstalled(m, saved))); };
ipcMain.handle('turbodocs:default-apps', () => queryDefaults(installedRows(), DESKTOP_ID));
ipcMain.handle('turbodocs:default-apps-set', async (_e, mimes: unknown) => {
  const allowedMimes = new Set(installedRows().map((r) => r.mime));
  const wanted = Array.isArray(mimes) ? mimes.filter((m): m is string => typeof m === 'string' && allowedMimes.has(m)) : [];
  if (process.platform === 'linux' && wanted.length) await setDefaults(wanted, DESKTOP_ID);
  return queryDefaults(installedRows(), DESKTOP_ID);
});
ipcMain.handle('turbodocs:graphics', () => graphics());
ipcMain.handle('turbodocs:gpu-get', () => { const c = loadDesktopConfig(userData()); return { mode: c.gpuMode, auto: c.gpuAuto, running: gpuStart.id, modes: GPU_MODES.map(({ id, label, hint }) => ({ id, label, hint })) }; });
ipcMain.handle('turbodocs:gpu-report', async () => {
  const g = await graphics();
  const info = await app.getGPUInfo('complete').catch(() => null);
  return JSON.stringify({ summary: g.summary, detail: g.detail, features: g.features, gpuCrashes: g.gpuCrashes, mode: gpuStart.id, electron: process.versions.electron, chrome: process.versions.chrome, session: { type: process.env.XDG_SESSION_TYPE, desktop: process.env.XDG_CURRENT_DESKTOP, display: process.env.DISPLAY, wayland: process.env.WAYLAND_DISPLAY }, gpuInfo: info }, null, 2);
});
ipcMain.on('turbodocs:gpu-page', () => { const w = new BrowserWindow({ width: 1000, height: 800, title: 'Chromium GPU report' }); void w.loadURL('chrome://gpu'); });
ipcMain.handle('turbodocs:gpu-set', (_e, mode: unknown) => {
  const id = typeof mode === 'string' && (mode === 'auto' || GPU_MODES.some((m) => m.id === mode)) ? mode : 'auto';
  saveDesktopConfig(userData(), { gpuMode: id, gpuAuto: { step: 0, done: false } });
  app.relaunch(); app.exit(0);
});
ipcMain.handle('turbodocs:update-has-token', () => !!loadUpdateToken(userData()));
ipcMain.handle('turbodocs:update-set-token', (_e, t: unknown) => { const v = typeof t === 'string' ? t.trim() : ''; saveUpdateToken(userData(), v); updates.setToken(v); });
ipcMain.handle('turbodocs:update-state', () => updates.state);
ipcMain.handle('turbodocs:update-check', () => updates.check());
ipcMain.on('turbodocs:update-install', () => updates.install());
ipcMain.on('turbodocs:window', (e, action: string) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (action === 'minimize') w.minimize();
  else if (action === 'maximize') { if (w.isMaximized()) w.unmaximize(); else w.maximize(); }
  else if (action === 'close') w.close();
});
ipcMain.handle('turbodocs:set-frame', async (_e, on: unknown) => {
  saveDesktopConfig(userData(), { customFrame: on === true });
  const r = await dialog.showMessageBox({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, message: 'Window style changed', detail: 'The new window style applies after the app restarts.' });
  if (r.response === 0) { app.relaunch(); app.quit(); }
});

/** There is no menu bar (everything it held is in Settings); the shortcuts people expect from it still work. */
function shortcuts(w: BrowserWindow) {
  w.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    const wc = w.webContents;
    const key = input.key.toLowerCase();
    const stop = () => e.preventDefault();
    // a reload would throw away unsaved changes: ask first
    const reload = (hard: boolean) => { if (dirty && dialog.showMessageBoxSync(w, { type: 'warning', buttons: ['Discard changes', 'Keep editing'], defaultId: 1, cancelId: 1, message: 'This document has unsaved changes.', detail: 'Reloading now loses them.' }) !== 0) return; dirty = false; if (hard) wc.reloadIgnoringCache(); else wc.reload(); };
    if (mod && key === 'r') { stop(); reload(input.shift); }
    else if (key === 'f5') { stop(); reload(false); }
    else if (mod && input.shift && key === 'i') { stop(); wc.toggleDevTools(); }
    else if (key === 'f12') { stop(); wc.toggleDevTools(); }
    else if (key === 'f11') { stop(); w.setFullScreen(!w.isFullScreen()); }
    else if (mod && (key === '=' || key === '+')) { stop(); wc.setZoomLevel(wc.getZoomLevel() + 0.5); }
    else if (mod && key === '-') { stop(); wc.setZoomLevel(wc.getZoomLevel() - 0.5); }
    else if (mod && key === '0') { stop(); wc.setZoomLevel(0); }
  });
}

let closing = false;
app.on('before-quit', (e) => {
  if (closing || !server) return;
  e.preventDefault(); closing = true;
  void server.close().finally(() => app.exit(0));
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win && server) openWindow(); });

void app.whenReady().then(async () => {
  if (!primary) return;
  try { await boot(); } catch (e) { dialog.showErrorBox('TurboDocs cannot start', (e as Error).message); app.exit(1); return; }
  Menu.setApplicationMenu(null);
  openWindow();
  updates.setToken(loadUpdateToken(userData()));
  updates.start();
  void settleGraphics();
});

/**
 * Automatic mode: a few seconds after the window opened, see whether Chromium really got the GPU. If not, remember the next way to start
 * the graphics and restart (at most once per start, and only until every mode has been tried); if yes, remember that one and stop looking.
 */
async function settleGraphics() {
  const c = loadDesktopConfig(userData());
  if (process.platform !== 'linux' || c.gpuMode !== 'auto' || c.gpuAuto.done || process.env.TURBODOCS_SOFTWARE_RENDERING) return;
  await new Promise((r) => setTimeout(r, 6000));
  const g = await graphics();
  const next = nextAutoStep({ mode: 'auto', auto: c.gpuAuto }, g.hardware && g.gpuCrashes === 0, process.env.XDG_SESSION_TYPE);
  console.log(`[turbodocs] graphics (${gpuStart.id}): ${g.summary}${next.done ? ' - settled' : ' - trying the next mode'}`);
  saveDesktopConfig(userData(), { gpuAuto: { step: next.step, done: next.done } });
  if (next.relaunch) { app.relaunch(); app.exit(0); }
}
