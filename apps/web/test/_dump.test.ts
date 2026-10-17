import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { exportPptx, importPptx } from '../src/slides/pptx.ts';
import { exportXlsx, importXlsx } from '../src/sheets/xlsx.ts';
const OUT = '/tmp/claude-0/-home-user/78d1156a-acca-52ea-a399-e22c3ef33c1f/scratchpad/fx/ours';
const fx = (n: string) => new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', n)));
it('dump', async () => {
  const { mkdirSync } = await import('node:fs'); mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/ours.pptx`, await exportPptx((await importPptx(fx('python-pptx.pptx'))).deck));
  writeFileSync(`${OUT}/ours.xlsx`, await exportXlsx((await importXlsx(fx('libreoffice-roundtrip.xlsx'))).book));
});
