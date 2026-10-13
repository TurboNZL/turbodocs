import { desktop } from './settings.ts';

/** How far the self-update of the installed app has got. */
export type UpdateState = {
  status: 'idle' | 'disabled' | 'checking' | 'none' | 'downloading' | 'ready' | 'error';
  version?: string; percent?: number; message?: string;
  /** an install is running (a password prompt is open) */
  installing?: boolean;
  /** what to run in a terminal when the app could not install the update itself */
  command?: string;
};

export interface NativeUpdates {
  state(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  /** restart the app on the new version */
  install(): void;
  /** a GitHub token for updates from a private repository */
  hasToken(): Promise<boolean>;
  setToken(token: string): Promise<void>;
  onState(cb: (s: UpdateState) => void): () => void;
}

export const appVersion = (): string | null => desktop()?.version ?? null;
export const nativeUpdates = (): NativeUpdates | null => desktop()?.updates ?? null;
