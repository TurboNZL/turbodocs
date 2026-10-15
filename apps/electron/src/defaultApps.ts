import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * "Open with" lists TurboDocs once the installer has registered its file types, but the desktop's DEFAULT application for a type is a
 * separate choice (LibreOffice also claims .docx, other editors claim .txt). On Linux the standard way to set it is `xdg-mime`; Windows and
 * macOS keep this in the system's own settings, which an app cannot change.
 */
export interface DefaultRow { ext: string; mime: string; module: string; isDefault: boolean }
export interface DefaultApps { supported: boolean; reason?: string; desktopId: string; rows: DefaultRow[] }

/** Parses `xdg-mime query default` output: a desktop file name, or nothing. */
export const parseDefault = (stdout: string) => stdout.trim().split('\n')[0]?.trim() ?? '';

export async function queryDefaults(rows: { ext: string; mime: string; module: string }[], desktopId: string): Promise<DefaultApps> {
  if (process.platform !== 'linux') return { supported: false, reason: process.platform === 'win32' ? 'Windows: Settings › Apps › Default apps lets you choose TurboDocs for each file type.' : 'macOS: select a file, choose Get Info, pick TurboDocs under "Open with" and press "Change All…".', desktopId, rows: rows.map((r) => ({ ...r, isDefault: false })) };
  try {
    const out: DefaultRow[] = [];
    for (const r of rows) out.push({ ...r, isDefault: parseDefault((await run('xdg-mime', ['query', 'default', r.mime])).stdout) === desktopId });
    return { supported: true, desktopId, rows: out };
  } catch (e) {
    return { supported: false, reason: `This system has no xdg-mime (${(e as Error).message.split('\n')[0]}). Set the default in your file manager's "Open with" dialog.`, desktopId, rows: rows.map((r) => ({ ...r, isDefault: false })) };
  }
}

export async function setDefaults(mimes: string[], desktopId: string): Promise<void> {
  await run('xdg-mime', ['default', desktopId, ...mimes]);
}
