import { githubSource, start, type TurboThemes } from 'turbothemes';

/**
 * Colours, UI styles, wallpaper and the scripted extras live in the turbothemes package; this file only starts the engine once with
 * what is specific to TurboDocs. `persist` keeps the user's choice in localStorage and applies it before the first paint at the next
 * start, `picker` registers <turbo-themes-picker> (Settings > Appearance). TurboDocs has no layouts of its own yet: one side bar.
 */
let engine: TurboThemes | null = null;

export function startAppearance(): TurboThemes {
  if (engine) return engine;
  const host = window as unknown as { turbodocsDesktop?: { desktopEnv?: string } };
  engine = start({
    persist: true,
    picker: true,
    appearance: { theme: 'auto', ui: 'auto' }, // first run: look like the device
    fonts: 'cdn', // TODO: bundle the @fontsource fonts (see docs/development/APPEARANCE.md) so every style works offline
    host: { desktopEnv: host.turbodocsDesktop?.desktopEnv },
    source: githubSource(),
  });
  return engine;
}

export { watchSystemTheme } from 'turbothemes';
