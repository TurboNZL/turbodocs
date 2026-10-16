// Before packaging: put the generated logo (apps/web/public/icon.svg, from branding/logo.json) where the .deb picks it up as the
// scalable icon. The Python version's .deb shipped /usr/share/icons/hicolor/scalable/apps/turbodocs.svg, and a scalable icon wins over
// PNGs in most icon themes, so the new package must replace that very file or a stale old logo can keep showing.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'build/deb-extra/usr/share/icons/hicolor/scalable/apps/turbodocs.svg');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(join(root, '../web/public/icon.svg'), dest);
console.log('scalable icon ->', dest);
