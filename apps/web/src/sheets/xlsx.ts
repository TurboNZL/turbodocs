import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { builtinFormat } from './format.ts';
import { colIndex, colName, emptySheet, key, parseAddr, parseRange, rangeText, unkey, type Borders, type Cell, type CellFmt, type Edge, type Sheet, type Workbook } from './model.ts';

/**
 * .xlsx <-> Workbook. Reading goes straight to the file's XML: values, formulas (kept, with the value the file last had), text, numbers, booleans, errors, dates,
 * cell formats (bold, italic, underline, colours, fill, borders, alignment, font, size, number format), column widths, row heights, merged cells, frozen panes, several sheets. What it
 * does not keep is listed in `warnings` (charts, pictures, pivot tables, conditional formatting, data validation, comments), like the Word importer. Saving writes a
 * new file with exactly what the editor shows.
 */
const NS = { main: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
type El = Element;
const kids = (e: El | null | undefined, name?: string): El[] => (e ? ([...e.childNodes].filter((c) => c.nodeType === 1) as El[]).filter((c) => !name || c.localName === name) : []);
const kid = (e: El | null | undefined, name: string): El | undefined => kids(e, name)[0];
const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml') as unknown as Document;
const attr = (e: El | null | undefined, n: string) => e?.getAttribute(n) ?? undefined;
const relId = (e: El) => e.getAttributeNS(NS.rel, 'id') ?? e.getAttribute('r:id') ?? '';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// characters XML 1.0 cannot hold are dropped
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');

const rgb = (c: El | undefined): string | undefined => { const v = attr(c, 'rgb'); return v && /^[0-9a-f]{8}$/i.test(v) ? `#${v.slice(2).toLowerCase()}` : undefined; };
const px = (chars: number) => Math.round(chars * 7 + 5);

export interface ImportedBook { book: Workbook; warnings: string[] }

export async function importXlsx(bytes: Uint8Array): Promise<ImportedBook> {
  const zip = await JSZip.loadAsync(bytes);
  const text = async (p: string) => (await zip.file(p)?.async('string')) ?? null;
  const warnings = new Set<string>();
  const wbXml = await text('xl/workbook.xml');
  if (!wbXml) throw new Error('This is not an Excel workbook (xl/workbook.xml is missing).');
  const wb = parse(wbXml).documentElement;
  if (kid(wb, 'workbookPr')?.getAttribute('date1904') === '1') warnings.add('This workbook uses the 1904 date system; dates are shown four years early.');
  const rels = new Map<string, string>();
  for (const r of kids(parse((await text('xl/_rels/workbook.xml.rels')) ?? '<r/>').documentElement, 'Relationship')) rels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
  const target = (t: string) => (t.startsWith('/') ? t.slice(1) : `xl/${t}`.replace(/\/\.\//g, '/'));

  // shared strings
  const strings: string[] = [];
  const sst = await text('xl/sharedStrings.xml');
  if (sst) for (const si of kids(parse(sst).documentElement, 'si')) strings.push([...si.getElementsByTagName('t')].filter((t) => t.parentNode && (t.parentNode as El).localName !== 'rPh').map((t) => t.textContent ?? '').join(''));

  // styles
  const fmts = new Map<number, string>();
  const fonts: { b?: boolean; i?: boolean; u?: boolean; color?: string; name?: string; sz?: number }[] = [];
  const fills: (string | undefined)[] = [];
  interface Xf { nf?: string; font: number; fill: number; border: number; align?: 'left' | 'center' | 'right'; va?: 'top' | 'middle'; wrap?: boolean }
  const borders: (Borders | undefined)[] = [];
  const EDGE: Record<string, Edge['st']> = { thin: 'thin', hair: 'thin', medium: 'medium', thick: 'thick', dashed: 'dashed', mediumDashed: 'dashed', dotted: 'dotted', double: 'double', dashDot: 'dashed', dashDotDot: 'dotted', slantDashDot: 'dashed', mediumDashDot: 'dashed', mediumDashDotDot: 'dashed' };
  const edgeOf = (e: El | undefined): Edge | undefined => { const st = EDGE[attr(e, 'style') ?? '']; return st ? { st, c: rgb(kid(e, 'color')) ?? '#000000' } : undefined; };
  const xfs: Xf[] = [];
  const stXml = await text('xl/styles.xml');
  if (stXml) {
    const st = parse(stXml).documentElement;
    for (const n of kids(kid(st, 'numFmts'), 'numFmt')) fmts.set(Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '');
    for (const f of kids(kid(st, 'fonts'), 'font')) fonts.push({ b: !!kid(f, 'b') && attr(kid(f, 'b'), 'val') !== '0', i: !!kid(f, 'i') && attr(kid(f, 'i'), 'val') !== '0', u: !!kid(f, 'u') && attr(kid(f, 'u'), 'val') !== 'none', color: rgb(kid(f, 'color')), name: attr(kid(f, 'name'), 'val'), sz: Number(attr(kid(f, 'sz'), 'val')) || undefined });
    for (const f of kids(kid(st, 'fills'), 'fill')) { const p = kid(f, 'patternFill'); fills.push(p && attr(p, 'patternType') === 'solid' ? rgb(kid(p, 'fgColor')) : undefined); }
    for (const b of kids(kid(st, 'borders'), 'border')) { const o: Borders = {}; const t = edgeOf(kid(b, 'top')), bo = edgeOf(kid(b, 'bottom')), l = edgeOf(kid(b, 'left')) ?? edgeOf(kid(b, 'start')), r = edgeOf(kid(b, 'right')) ?? edgeOf(kid(b, 'end')); if (t) o.t = t; if (bo) o.b = bo; if (l) o.l = l; if (r) o.r = r; borders.push(Object.keys(o).length ? o : undefined); }
    for (const x of kids(kid(st, 'cellXfs'), 'xf')) {
      const id = Number(x.getAttribute('numFmtId') ?? 0);
      const al = kid(x, 'alignment');
      const h = attr(al, 'horizontal');
      const v = attr(al, 'vertical');
      xfs.push({ nf: fmts.get(id) ?? builtinFormat(id) ?? undefined, font: Number(x.getAttribute('fontId') ?? 0), fill: Number(x.getAttribute('fillId') ?? 0), border: Number(x.getAttribute('borderId') ?? 0), align: h === 'center' || h === 'right' || h === 'left' ? h : undefined, va: v === 'top' ? 'top' : v === 'center' ? 'middle' : undefined, wrap: attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true' });
    }
  }
  const base = fonts[0] ?? {};
  const fmtOf = (s: number): CellFmt | undefined => {
    const x = xfs[s];
    if (!x || s === 0 && !x.nf && !x.align && !x.va) return undefined;
    const f = fonts[x.font] ?? {};
    const o: CellFmt = {};
    if (f.b) o.b = true; if (f.i) o.i = true; if (f.u) o.u = true;
    if (f.color && f.color !== '#000000') o.color = f.color;
    if (f.name && f.name !== base.name) o.font = f.name;
    if (f.sz && f.sz !== base.sz) o.size = f.sz;
    const fill = fills[x.fill]; if (fill) o.fill = fill;
    if (x.align) o.align = x.align; if (x.va) o.va = x.va; if (x.wrap) o.wrap = true;
    const bd = borders[x.border]; if (bd) o.bd = bd;
    if (x.nf && !/^general$/i.test(x.nf)) o.nf = x.nf;
    return Object.keys(o).length ? o : undefined;
  };

  const book: Workbook = { sheets: [], active: 0 };
  const sheetEls = kids(kid(wb, 'sheets'), 'sheet');
  const sheetPaths: string[] = [];
  for (const [i, s] of sheetEls.entries()) {
    const path = target(rels.get(relId(s)) ?? '');
    sheetPaths.push(path);
    const xml = await text(path);
    const sheet = emptySheet(s.getAttribute('name') ?? `Sheet${i + 1}`);
    book.sheets.push(sheet);
    if (!xml) continue;
    const ws = parse(xml).documentElement;
    for (const c of kids(kid(ws, 'cols'), 'col')) {
      const w = Number(c.getAttribute('width')); const lo = Number(c.getAttribute('min')) - 1, hi = Math.min(Number(c.getAttribute('max')) - 1, lo + 200);
      if (w > 0 && !['1', 'true'].includes(c.getAttribute('hidden') ?? '')) for (let k = lo; k <= hi; k++) sheet.colW[k] = px(w);
    }
    for (const r of kids(kid(ws, 'sheetData'), 'row')) {
      const ri = Number(r.getAttribute('r')) - 1;
      const ht = Number(r.getAttribute('ht'));
      if (ht > 0 && ['1', 'true'].includes(r.getAttribute('customHeight') ?? '')) sheet.rowH[ri] = Math.round(ht / 0.75);
      let next = 0;
      for (const c of kids(r, 'c')) {
        const a = parseAddr(c.getAttribute('r') ?? '');
        const ci = a ? a[1] : next; const row = a ? a[0] : ri;
        next = ci + 1;
        const t = c.getAttribute('t') ?? 'n';
        const f = kid(c, 'f');
        const vEl = kid(c, 'v');
        const cell: Cell = { v: null };
        if (t === 's') cell.v = strings[Number(vEl?.textContent)] ?? '';
        else if (t === 'inlineStr') cell.v = [...(kid(c, 'is')?.getElementsByTagName('t') ?? [])].map((x) => x.textContent ?? '').join('');
        else if (t === 'str' || t === 'd') cell.v = vEl?.textContent ?? '';
        else if (t === 'b') cell.v = vEl?.textContent === '1';
        else if (t === 'e') { cell.v = vEl?.textContent ?? '#VALUE!'; cell.err = true; }
        else if (vEl && vEl.textContent !== '') cell.v = Number(vEl.textContent);
        if (f) { const ft = f.textContent ?? ''; if (ft) cell.f = ft; else if (f.getAttribute('t') === 'shared') warnings.add('A shared formula was kept as its value only.'); }
        const s = fmtOf(Number(c.getAttribute('s') ?? 0)); if (s) cell.s = s;
        if (cell.v !== null || cell.s || cell.f) sheet.cells[key(row, ci)] = cell;
      }
    }
    for (const m of kids(kid(ws, 'mergeCells'), 'mergeCell')) { const g = parseRange(m.getAttribute('ref') ?? ''); if (g) sheet.merges.push(g); }
    if (kid(ws, 'conditionalFormatting')) warnings.add('Conditional formatting.');
    if (kid(ws, 'dataValidations')) warnings.add('Data validation lists.');
    if (kid(ws, 'hyperlinks')) warnings.add('Hyperlinks (the text is kept, not the link).');
    if (kid(ws, 'drawing') || kid(ws, 'legacyDrawing')) warnings.add('Charts, pictures and comments.');
    if (kid(ws, 'tableParts')) warnings.add('Excel tables (the cells are kept, not the table).');
    const pane = kid(kid(kid(ws, 'sheetViews'), 'sheetView'), 'pane');
    if (pane && ['frozen', 'frozenSplit'].includes(pane.getAttribute('state') ?? '')) { const fc = Math.round(Number(pane.getAttribute('xSplit') ?? 0)), fr = Math.round(Number(pane.getAttribute('ySplit') ?? 0)); if (fc > 0 || fr > 0) sheet.freeze = { rows: fr, cols: fc }; }
    else if (pane) warnings.add('Split panes (shown as one).');
  }
  const names = Object.keys(zip.files);
  if (names.some((n) => /^xl\/pivotTables\//.test(n))) warnings.add('Pivot tables.');
  if (names.some((n) => /^xl\/(charts|media)\//.test(n))) warnings.add('Charts and pictures.');
  if (names.some((n) => /vbaProject\.bin$/.test(n))) warnings.add('Macros.');
  const act = Number(kid(kid(wb, 'bookViews'), 'workbookView')?.getAttribute('activeTab') ?? 0);
  book.active = act >= 0 && act < book.sheets.length ? act : 0;
  return { book, warnings: [...warnings] };
}

/** A new .xlsx from the workbook. */
export async function exportXlsx(book: Workbook): Promise<Uint8Array> {
  // style table: every distinct CellFmt becomes an xf
  const fmtIndex = new Map<string, number>();
  const fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const numFmts: string[] = [];
  const borderList: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const borderIdx = new Map<string, number>();
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const edgeXml = (tag: string, e: Edge | undefined) => (e ? `<${tag} style="${e.st}"><color rgb="FF${e.c.slice(1).toUpperCase()}"/></${tag}>` : `<${tag}/>`);
  const fontIdx = new Map<string, number>(), fillIdx = new Map<string, number>(), nfIdx = new Map<string, number>();
  const BUILT = new Map<string, number>([['0', 1], ['0.00', 2], ['#,##0', 3], ['#,##0.00', 4], ['0%', 9], ['0.00%', 10], ['0.00E+00', 11], ['@', 49]]);
  const styleOf = (s: CellFmt | undefined): number => {
    if (!s) return 0;
    const k = JSON.stringify(s);
    const have = fmtIndex.get(k);
    if (have !== undefined) return have;
    const fk = JSON.stringify([s.b, s.i, s.u, s.color, s.font, s.size]);
    let font = 0;
    if (s.b || s.i || s.u || s.color || s.font || s.size) {
      if (!fontIdx.has(fk)) { fontIdx.set(fk, fonts.length); fonts.push(`<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.u ? '<u/>' : ''}<sz val="${s.size ?? 11}"/>${s.color ? `<color rgb="FF${s.color.slice(1).toUpperCase()}"/>` : ''}<name val="${esc(s.font ?? 'Calibri')}"/><family val="2"/></font>`); }
      font = fontIdx.get(fk)!;
    }
    let fill = 0;
    if (s.fill) { if (!fillIdx.has(s.fill)) { fillIdx.set(s.fill, fills.length); fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`); } fill = fillIdx.get(s.fill)!; }
    let nf = 0;
    if (s.nf) {
      const built = BUILT.get(s.nf);
      if (built !== undefined) nf = built;
      else { if (!nfIdx.has(s.nf)) { nfIdx.set(s.nf, 164 + nfIdx.size); numFmts.push(`<numFmt numFmtId="${nfIdx.get(s.nf)}" formatCode="${esc(s.nf)}"/>`); } nf = nfIdx.get(s.nf)!; }
    }
    let border = 0;
    if (s.bd) { const bx = `<border>${edgeXml('left', s.bd.l)}${edgeXml('right', s.bd.r)}${edgeXml('top', s.bd.t)}${edgeXml('bottom', s.bd.b)}<diagonal/></border>`; if (!borderIdx.has(bx)) { borderIdx.set(bx, borderList.length); borderList.push(bx); } border = borderIdx.get(bx)!; }
    const align = s.align || s.wrap || s.va ? `<alignment${s.align ? ` horizontal="${s.align}"` : ''}${s.va ? ` vertical="${s.va === 'middle' ? 'center' : s.va}"` : ''}${s.wrap ? ' wrapText="1"' : ''}/>` : '';
    xfs.push(`<xf numFmtId="${nf}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`);
    fmtIndex.set(k, xfs.length - 1);
    return xfs.length - 1;
  };

  const shared: string[] = [], sharedIdx = new Map<string, number>();
  const sst = (s: string) => { let i = sharedIdx.get(s); if (i === undefined) { i = shared.length; shared.push(s); sharedIdx.set(s, i); } return i; };
  let anyFormula = false;

  const paneXml = (sh: Sheet): string => {
    const fr = sh.freeze?.rows ?? 0, fc = sh.freeze?.cols ?? 0;
    if (fr <= 0 && fc <= 0) return '';
    const active = fr > 0 && fc > 0 ? 'bottomRight' : fr > 0 ? 'bottomLeft' : 'topRight';
    return `<pane${fc > 0 ? ` xSplit="${fc}"` : ''}${fr > 0 ? ` ySplit="${fr}"` : ''} topLeftCell="${colName(fc)}${fr + 1}" activePane="${active}" state="frozen"/><selection pane="${active}"/>`;
  };
  const sheetXml = (sh: Sheet, selected: boolean): string => {
    const rows = new Map<number, [number, Cell][]>();
    for (const [k, cell] of Object.entries(sh.cells)) { const [r, c] = unkey(k); if (!rows.has(r)) rows.set(r, []); rows.get(r)!.push([c, cell]); }
    for (const r of Object.keys(sh.rowH)) if (!rows.has(Number(r))) rows.set(Number(r), []);
    const body = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([r, cells]) => {
      const ht = sh.rowH[r];
      const cs = cells.sort((a, b) => a[0] - b[0]).map(([c, cell]) => {
        const ref = `${colName(c)}${r + 1}`, s = styleOf(cell.s), sa = s ? ` s="${s}"` : '';
        if (cell.f !== undefined) anyFormula = true;
        const f = cell.f !== undefined ? `<f>${esc(clean(cell.f))}</f>` : '';
        const v = cell.v;
        if (v === null || v === '') return f ? `<c r="${ref}"${sa}>${f}</c>` : `<c r="${ref}"${sa}/>`;
        if (cell.err) return `<c r="${ref}"${sa} t="e">${f}<v>${esc(String(v))}</v></c>`;
        if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${sa}>${f}<v>${v}</v></c>` : `<c r="${ref}"${sa} t="e"><v>#NUM!</v></c>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${sa} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
        return f ? `<c r="${ref}"${sa} t="str">${f}<v>${esc(clean(v))}</v></c>` : `<c r="${ref}"${sa} t="s"><v>${sst(clean(v))}</v></c>`;
      }).join('');
      return `<row r="${r + 1}"${ht ? ` ht="${(ht * 0.75).toFixed(2)}" customHeight="1"` : ''}>${cs}</row>`;
    }).join('');
    const cols = Object.entries(sh.colW).sort((a, b) => Number(a[0]) - Number(b[0])).map(([c, w]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${Math.max(1, (w - 5) / 7).toFixed(2)}" customWidth="1"/>`).join('');
    const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${rangeText(m)}"/>`).join('')}</mergeCells>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS.main}" xmlns:r="${NS.rel}"><sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${paneXml(sh)}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData>${merges}</worksheet>`;
  };

  const zip = new JSZip();
  const sheets = book.sheets.length ? book.sheets : [emptySheet('Sheet1')];
  sheets.forEach((sh, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh, i === book.active)));
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS.main}" xmlns:r="${NS.rel}"><bookViews><workbookView activeTab="${Math.min(book.active, sheets.length - 1)}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(clean(s.name).slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${anyFormula ? '<calcPr fullCalcOnLoad="1"/>' : ''}</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS.main}">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borderList.length}">${borderList.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${NS.main}" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
void colIndex;
