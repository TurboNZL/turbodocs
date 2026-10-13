// Bundles the main process (ESM) and the preload script (must be CommonJS) into dist/.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const common = { bundle: true, platform: 'node', target: 'node22', sourcemap: true, logLevel: 'info', absWorkingDir: root };

await build({
  ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.mjs', format: 'esm', external: ['electron'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs', format: 'cjs', external: ['electron'] });
