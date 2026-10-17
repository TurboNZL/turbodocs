import { useSyncExternalStore } from 'react';
import { desktop } from './settings.ts';
import { detectedFonts, detectSystemFonts, fontInstalled, fontPermission, onFontsDetected, type Detection } from './systemFonts.ts';

/**
 * The installed fonts for the font boxes (engine module `system-fonts`). Electron answers `queryLocalFonts()` with no prompt; a plain browser is asked only
 * when the person already allowed it (the Fonts button in the font box asks otherwise).
 */
export async function startFontDetection(): Promise<void> {
  if (desktop() || (await fontPermission()) === 'granted') await detectSystemFonts();
}
export const askForFonts = () => detectSystemFonts();
export function useDetectedFonts(): Detection | null {
  return useSyncExternalStore((f) => onFontsDetected(f), () => detectedFonts());
}
/** Is a font that a document names present on this device? (Only meaningful once drawn text can be measured; true when unsure.) */
export function deviceHasFont(name: string, detected: Detection | null): boolean {
  if (detected?.source === 'local-fonts') { const n = name.toLowerCase(); return detected.fonts.some((f) => f.family.toLowerCase() === n); }
  try { return fontInstalled(name); } catch { return true; }
}
