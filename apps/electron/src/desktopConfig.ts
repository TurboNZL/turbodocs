import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** What the desktop app remembers between launches (not the documents themselves). */
export interface DesktopConfig {
  /** the port of the window's local web server. It stays fixed because the web client's storage (the chosen theme ...) belongs to this address. */
  port: number;
  /** draw the window's title bar in the page, in the chosen theme, instead of the system's (needs a restart) */
  customFrame: boolean;
  /** which app modules are installed (modules.ts); missing = the module's default */
  modules: Record<string, boolean>;
  /** how Chromium starts its graphics (gpuModes.ts): "auto" tries them in turn, or a mode id */
  gpuMode: string;
  /** where Automatic is in its search, and whether it has settled */
  gpuAuto: { step: number; done: boolean };
}

export const DESKTOP_PORT = 47815;
const FILE = 'desktop.json';

/** Read the saved choices, with defaults for anything missing or unreadable. `userData` is Electron's per-user folder. */
export function loadDesktopConfig(userData: string, env: NodeJS.ProcessEnv = process.env): DesktopConfig {
  let saved: Partial<DesktopConfig> = {};
  try { saved = JSON.parse(readFileSync(join(userData, FILE), 'utf8')) as Partial<DesktopConfig>; } catch { /* first launch */ }
  const port = Number(env.TURBODOCS_DESKTOP_PORT ?? saved.port ?? DESKTOP_PORT);
  const modules: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(saved.modules ?? {})) if (typeof v === 'boolean') modules[k] = v;
  return {
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DESKTOP_PORT,
    customFrame: saved.customFrame === true,
    modules,
    gpuMode: typeof saved.gpuMode === 'string' ? saved.gpuMode : 'auto',
    gpuAuto: { step: Number(saved.gpuAuto?.step) || 0, done: saved.gpuAuto?.done === true },
  };
}

export function saveDesktopConfig(userData: string, patch: Partial<DesktopConfig>) {
  const path = join(userData, FILE);
  let cur: Partial<DesktopConfig> = {};
  try { cur = JSON.parse(readFileSync(path, 'utf8')) as Partial<DesktopConfig>; } catch { /* none yet */ }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...cur, ...patch }, null, 2));
}

/** Where the built web client is: in the packaged app next to the executable's resources, in development in the monorepo. */
export function findWebDir(resourcesPath: string, devDir: string): string | null {
  for (const dir of [join(resourcesPath, 'web'), devDir]) if (existsSync(join(dir, 'index.html'))) return dir;
  return null;
}

/** GitHub token for updates from a private repository (stored in the user's own app folder). */
export const loadUpdateToken = (userData: string): string => {
  try { const t = (JSON.parse(readFileSync(join(userData, FILE), 'utf8')) as { updateToken?: unknown }).updateToken; return typeof t === 'string' ? t : ''; } catch { return ''; }
};
export const saveUpdateToken = (userData: string, token: string) => saveDesktopConfig(userData, { updateToken: token.trim() } as Partial<DesktopConfig>);
