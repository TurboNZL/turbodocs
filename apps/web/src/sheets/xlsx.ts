import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { builtinFormat } from './format.ts';
import { buildChartParts, readCharts } from './xlsxCharts.ts';
import { hiddenRows } from './rules.ts';
import { colIndex, colName, emptySheet, key, parseAddr, parseRange, rangeText, unkey, type Borders, type Cell, type CellFmt, type CfRule, type Edge, type Range, type Sheet, type Validation, type Workbook } from './model.ts';

/**
 * .xlsx <-> Workbook. Reading goes straight to the file's XML: values, formulas (kept, with the value the file last had), text, numbers, booleans, errors, dates,
 * hyperlinks, conditional formatting (comparisons, text, blanks, two-colour scales), data validation (lists and numbers), filters on lists of values,
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
  const fonts: { b?: boolean; i?: boolean; u?: boolean; st?: boolean; color?: string; name?: string; sz?: number }[] = [];
  const fills: (string | undefined)[] = [];
  interface Xf { nf?: string; font: number; fill: number; border: number; align?: 'left' | 'center' | 'right'; va?: 'top' | 'middle'; wrap?: boolean }
  const borders: (Borders | undefined)[] = [];
  const dxfs: { color?: string; bold?: boolean; fill?: string }[] = [];
  const EDGE: Record<string, Edge['st']> = { thin: 'thin', hair: 'thin', medium: 'medium', thick: 'thick', dashed: 'dashed', mediumDashed: 'dashed', dotted: 'dotted', double: 'double', dashDot: 'dashed', dashDotDot: 'dotted', slantDashDot: 'dashed', mediumDashDot: 'dashed', mediumDashDotDot: 'dashed' };
  const edgeOf = (e: El | undefined): Edge | undefined => { const st = EDGE[attr(e, 'style') ?? '']; return st ? { st, c: rgb(kid(e, 'color')) ?? '#000000' } : undefined; };
  const xfs: Xf[] = [];
  const stXml = await text('xl/styles.xml');
  if (stXml) {
    const st = parse(stXml).documentElement;
    for (const n of kids(kid(st, 'numFmts'), 'numFmt')) fmts.set(Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '');
    for (const f of kids(kid(st, 'fonts'), 'font')) fonts.push({ b: !!kid(f, 'b') && attr(kid(f, 'b'), 'val') !== '0', i: !!kid(f, 'i') && attr(kid(f, 'i'), 'val') !== '0', u: !!kid(f, 'u') && attr(kid(f, 'u'), 'val') !== 'none', st: !!kid(f, 'strike') && attr(kid(f, 'strike'), 'val') !== '0', color: rgb(kid(f, 'color')), name: attr(kid(f, 'name'), 'val'), sz: Number(attr(kid(f, 'sz'), 'val')) || undefined });
    for (const f of kids(kid(st, 'fills'), 'fill')) { const p = kid(f, 'patternFill'); fills.push(p && attr(p, 'patternType') === 'solid' ? rgb(kid(p, 'fgColor')) : undefined); }
    for (const b of kids(kid(st, 'borders'), 'border')) { const o: Borders = {}; const t = edgeOf(kid(b, 'top')), bo = edgeOf(kid(b, 'bottom')), l = edgeOf(kid(b, 'left')) ?? edgeOf(kid(b, 'start')), r = edgeOf(kid(b, 'right')) ?? edgeOf(kid(b, 'end')); if (t) o.t = t; if (bo) o.b = bo; if (l) o.l = l; if (r) o.r = r; borders.push(Object.keys(o).length ? o : undefined); }
    for (const d of kids(kid(st, 'dxfs'), 'dxf')) { const f = kid(d, 'font'), fill = kid(kid(d, 'fill'), 'patternFill'); dxfs.push({ color: rgb(kid(f, 'color')), bold: !!kid(f, 'b') && attr(kid(f, 'b'), 'val') !== '0' ? true : undefined, fill: rgb(kid(fill, 'bgColor')) ?? rgb(kid(fill, 'fgColor')) }); }
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
    if (f.b) o.b = true; if (f.i) o.i = true; if (f.u) o.u = true; if (f.st) o.st = true;
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
    let hiddenSeen = false;
    const ws = parse(xml).documentElement;
    for (const c of kids(kid(ws, 'cols'), 'col')) {
      const w = Number(c.getAttribute('width')); const lo = Number(c.getAttribute('min')) - 1, hi = Math.min(Number(c.getAttribute('max')) - 1, lo + 200);
      if (w > 0 && !['1', 'true'].includes(c.getAttribute('hidden') ?? '')) for (let k = lo; k <= hi; k++) sheet.colW[k] = px(w);
    }
    for (const r of kids(kid(ws, 'sheetData'), 'row')) {
      const ri = Number(r.getAttribute('r')) - 1;
      if (['1', 'true'].includes(r.getAttribute('hidden') ?? '')) hiddenSeen = true;
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
    const extRels = new Map<string, string>();
    const rx = await text(path.replace(/([^/]+)$/, '_rels/$1.rels'));
    if (rx) for (const r of kids(parse(rx).documentElement, 'Relationship')) if (r.getAttribute('TargetMode') === 'External') extRels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
    readRules(ws, sheet, extRels, dxfs, warnings);
    if (hiddenSeen && !sheet.filter) warnings.add('Hidden rows (they are shown).');
    await readCharts(zip, path, ws, sheet, warnings);
    if (kid(ws, 'tableParts')) warnings.add('Excel tables (the cells are kept, not the table).');
    const pane = kid(kid(kid(ws, 'sheetViews'), 'sheetView'), 'pane');
    if (pane && ['frozen', 'frozenSplit'].includes(pane.getAttribute('state') ?? '')) { const fc = Math.round(Number(pane.getAttribute('xSplit') ?? 0)), fr = Math.round(Number(pane.getAttribute('ySplit') ?? 0)); if (fc > 0 || fr > 0) sheet.freeze = { rows: fr, cols: fc }; }
    else if (pane) warnings.add('Split panes (shown as one).');
  }
  const names = Object.keys(zip.files);
  if (names.some((n) => /^xl\/pivotTables\//.test(n))) warnings.add('Pivot tables.');

  if (names.some((n) => /vbaProject\.bin$/.test(n))) warnings.add('Macros.');
  const act = Number(kid(kid(wb, 'bookViews'), 'workbookView')?.getAttribute('activeTab') ?? 0);
  book.active = act >= 0 && act < book.sheets.length ? act : 0;
  return { book, warnings: [...warnings] };
}

const sqrefs = (v: string | undefined): Range[] => (v ?? '').split(/\s+/).map((x) => parseRange(x)).filter((g): g is Range => !!g);
const unquote = (f: string) => (/^".*"$/.test(f) ? f.slice(1, -1).replace(/""/g, '"') : f);
const CF_OP: Record<string, CfRule['kind']> = { greaterThan: 'gt', greaterThanOrEqual: 'ge', lessThan: 'lt', lessThanOrEqual: 'le', equal: 'eq', notEqual: 'ne', between: 'between' };
let ruleSeq = 0;

/** hyperlinks, conditional formatting, data validation and the filter of one worksheet */
function readRules(ws: El, sheet: Sheet, rels: Map<string, string>, dxfs: { color?: string; bold?: boolean; fill?: string }[], warnings: Set<string>): void {
  for (const h of kids(kid(ws, 'hyperlinks'), 'hyperlink')) {
    const url = rels.get(h.getAttributeNS(NS.rel, 'id') ?? h.getAttribute('r:id') ?? '');
    if (!url) { warnings.add('Links to places inside the workbook (the text is kept, not the link).'); continue; }
    if (!/^(https?:|mailto:)/i.test(url)) { warnings.add('Links other than web and e-mail addresses (the text is kept, not the link).'); continue; }
    for (const g of sqrefs(h.getAttribute('ref') ?? undefined)) for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 2000); r++) for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 200); c++) { const cell = sheet.cells[key(r, c)] ?? { v: null }; sheet.cells[key(r, c)] = { ...cell, link: url }; }
  }
  const rules: { rule: CfRule; priority: number }[] = [];
  for (const cf of kids(ws, 'conditionalFormatting')) for (const rr of kids(cf, 'cfRule')) {
    const look = dxfs[Number(rr.getAttribute('dxfId'))] ?? {};
    const type = rr.getAttribute('type') ?? '', f1 = kid(rr, 'formula')?.textContent ?? '', f2 = kids(rr, 'formula')[1]?.textContent ?? '';
    let base: Omit<CfRule, 'id' | 'range'> | null = null;
    if (type === 'cellIs' && CF_OP[rr.getAttribute('operator') ?? '']) base = { kind: CF_OP[rr.getAttribute('operator')!], v1: unquote(f1), ...(CF_OP[rr.getAttribute('operator')!] === 'between' ? { v2: unquote(f2) } : {}), ...look };
    else if (type === 'containsText') base = { kind: 'text', v1: rr.getAttribute('text') ?? '', ...look };
    else if (type === 'containsBlanks') base = { kind: 'blank', ...look };
    else if (type === 'notContainsBlanks') base = { kind: 'notblank', ...look };
    else if (type === 'colorScale') {
      const cols = kids(kid(rr, 'colorScale'), 'color').map((c) => rgb(c));
      if (cols.length >= 2 && cols[0] && cols[cols.length - 1]) { base = { kind: 'scale', lo: cols[0], hi: cols[cols.length - 1] }; if (cols.length > 2) warnings.add('Three-colour scales are shown with two colours.'); }
    }
    if (!base) { warnings.add('Some conditional formatting rules (only comparisons, text, blanks and colour scales are kept).'); continue; }
    for (const g of sqrefs(cf.getAttribute('sqref') ?? undefined)) rules.push({ rule: { id: `cf${ruleSeq++}`, range: g, ...base }, priority: Number(rr.getAttribute('priority') ?? 0) });
  }
  if (rules.length) sheet.cf = rules.sort((a, b) => a.priority - b.priority).map((x) => x.rule);
  const dvs: Validation[] = [];
  for (const d of kids(kid(ws, 'dataValidations'), 'dataValidation')) {
    const type = d.getAttribute('type') ?? '', f1 = kid(d, 'formula1')?.textContent ?? '', f2 = kid(d, 'formula2')?.textContent ?? '', op = d.getAttribute('operator') ?? 'between';
    const blank = ['1', 'true'].includes(d.getAttribute('allowBlank') ?? '');
    const message = d.getAttribute('error') ?? undefined;
    let v: Omit<Validation, 'range'> | null = null;
    if (type === 'list') v = /^".*"$/.test(f1) ? { kind: 'list', items: unquote(f1).split(',').map((x) => x.trim()), blank, message } : { kind: 'list', source: f1, blank, message };
    else if ((type === 'whole' || type === 'decimal') && Number.isFinite(Number(f1))) {
      const a = Number(f1), b = f2 === '' ? undefined : Number(f2);
      v = { kind: type, blank, message, ...(op === 'between' ? { min: a, max: b } : op === 'greaterThanOrEqual' ? { min: a } : op === 'greaterThan' ? { min: a + (type === 'whole' ? 1 : 0) } : op === 'lessThanOrEqual' ? { max: a } : op === 'lessThan' ? { max: a - (type === 'whole' ? 1 : 0) } : op === 'equal' ? { min: a, max: a } : {}) };
    }
    if (!v) { warnings.add('Some data validation rules (only lists and numbers are kept).'); continue; }
    for (const g of sqrefs(d.getAttribute('sqref') ?? undefined)) dvs.push({ ...v, range: g });
  }
  if (dvs.length) sheet.dv = dvs;
  const af = kid(ws, 'autoFilter');
  const ref = af ? parseRange(af.getAttribute('ref') ?? '') : null;
  if (af && ref) {
    const show: Record<number, string[]> = {};
    for (const fc of kids(af, 'filterColumn')) {
      const list = kid(fc, 'filters');
      if (!list) { warnings.add('Filters other than lists of values (the filter is kept without that condition).'); continue; }
      show[ref.c1 + Number(fc.getAttribute('colId') ?? 0)] = [...kids(list, 'filter').map((x) => x.getAttribute('val') ?? ''), ...(list.getAttribute('blank') === '1' ? [''] : [])];
    }
    sheet.filter = { range: ref, show };
  }
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
    const fk = JSON.stringify([s.b, s.i, s.u, s.st, s.color, s.font, s.size]);
    let font = 0;
    if (s.b || s.i || s.u || s.st || s.color || s.font || s.size) {
      if (!fontIdx.has(fk)) { fontIdx.set(fk, fonts.length); fonts.push(`<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.st ? '<strike/>' : ''}${s.u ? '<u/>' : ''}<sz val="${s.size ?? 11}"/>${s.color ? `<color rgb="FF${s.color.slice(1).toUpperCase()}"/>` : ''}<name val="${esc(s.font ?? 'Calibri')}"/><family val="2"/></font>`); }
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
  const dxfList: string[] = [];
  const dxfOf = (r: CfRule): number => {
    const x = `<dxf>${r.bold || r.color ? `<font>${r.bold ? '<b/>' : ''}${r.color ? `<color rgb="FF${r.color.slice(1).toUpperCase()}"/>` : ''}</font>` : ''}${r.fill ? `<fill><patternFill><bgColor rgb="FF${r.fill.slice(1).toUpperCase()}"/></patternFill></fill>` : ''}</dxf>`;
    let i = dxfList.indexOf(x); if (i < 0) { dxfList.push(x); i = dxfList.length - 1; } return i;
  };
  const CF_NAME: Record<string, string> = { gt: 'greaterThan', ge: 'greaterThanOrEqual', lt: 'lessThan', le: 'lessThanOrEqual', eq: 'equal', ne: 'notEqual', between: 'between' };
  const q = (v: string) => (Number.isFinite(Number(v)) && v.trim() !== '' ? v.trim() : `"${v.replace(/"/g, '""')}"`);
  const sheetRels = new Map<number, string>();
  const rulesXml = (sh: Sheet, links: string[]): { filter: string; cf: string; dv: string; hl: string } => {
    const f = sh.filter;
    const filter = f ? `<autoFilter ref="${rangeText(f.range)}">${Object.entries(f.show).map(([c, vals]) => `<filterColumn colId="${Number(c) - f.range.c1}"><filters${vals.includes('') ? ' blank="1"' : ''}>${vals.filter((x) => x !== '').map((x) => `<filter val="${esc(clean(x))}"/>`).join('')}</filters></filterColumn>`).join('')}</autoFilter>` : '';
    let prio = 0;
    const cf = (sh.cf ?? []).map((r) => {
      const ref = rangeText(r.range), tl = `${colName(r.range.c1)}${r.range.r1 + 1}`;
      prio++;
      if (r.kind === 'scale') return `<conditionalFormatting sqref="${ref}"><cfRule type="colorScale" priority="${prio}"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FF${(r.lo ?? '#ffffff').slice(1).toUpperCase()}"/><color rgb="FF${(r.hi ?? '#63be7b').slice(1).toUpperCase()}"/></colorScale></cfRule></conditionalFormatting>`;
      const dx = dxfOf(r);
      if (r.kind === 'text') return `<conditionalFormatting sqref="${ref}"><cfRule type="containsText" dxfId="${dx}" priority="${prio}" operator="containsText" text="${esc(r.v1 ?? '')}"><formula>NOT(ISERROR(SEARCH("${esc((r.v1 ?? '').replace(/"/g, '""'))}",${tl})))</formula></cfRule></conditionalFormatting>`;
      if (r.kind === 'blank') return `<conditionalFormatting sqref="${ref}"><cfRule type="containsBlanks" dxfId="${dx}" priority="${prio}"><formula>LEN(TRIM(${tl}))=0</formula></cfRule></conditionalFormatting>`;
      if (r.kind === 'notblank') return `<conditionalFormatting sqref="${ref}"><cfRule type="notContainsBlanks" dxfId="${dx}" priority="${prio}"><formula>LEN(TRIM(${tl}))&gt;0</formula></cfRule></conditionalFormatting>`;
      return `<conditionalFormatting sqref="${ref}"><cfRule type="cellIs" dxfId="${dx}" priority="${prio}" operator="${CF_NAME[r.kind]}"><formula>${esc(q(r.v1 ?? '0'))}</formula>${r.kind === 'between' ? `<formula>${esc(q(r.v2 ?? '0'))}</formula>` : ''}</cfRule></conditionalFormatting>`;
    }).join('');
    const dvs = (sh.dv ?? []).map((v) => {
      const common = `allowBlank="${v.blank ? 1 : 0}" showErrorMessage="1"${v.message ? ` error="${esc(v.message)}"` : ''} sqref="${rangeText(v.range)}"`;
      if (v.kind === 'list') return `<dataValidation type="list" ${common}><formula1>${v.items ? `"${esc(v.items.join(',').replace(/"/g, '""'))}"` : esc(v.source ?? '')}</formula1></dataValidation>`;
      const op = v.min !== undefined && v.max !== undefined ? 'between' : v.min !== undefined ? 'greaterThanOrEqual' : 'lessThanOrEqual';
      return `<dataValidation type="${v.kind}" operator="${op}" ${common}><formula1>${v.min ?? v.max ?? 0}</formula1>${op === 'between' ? `<formula2>${v.max}</formula2>` : ''}</dataValidation>`;
    });
    const dv = dvs.length ? `<dataValidations count="${dvs.length}">${dvs.join('')}</dataValidations>` : '';
    const hls: string[] = [];
    for (const [k, cell] of Object.entries(sh.cells)) if (cell.link) { const [r, c] = unkey(k); links.push(cell.link); hls.push(`<hyperlink ref="${colName(c)}${r + 1}" r:id="rId${links.length + 1}"/>`); }
    return { filter, cf, dv, hl: hls.length ? `<hyperlinks>${hls.join('')}</hyperlinks>` : '' };
  };
  const sheetXml = (sh: Sheet, selected: boolean, drawing: string | undefined, index: number): string => {
    const links: string[] = [];
    const hidden = hiddenRows(sh);
    const rx = rulesXml(sh, links);
    const rows = new Map<number, [number, Cell][]>();
    for (const [k, cell] of Object.entries(sh.cells)) { const [r, c] = unkey(k); if (!rows.has(r)) rows.set(r, []); rows.get(r)!.push([c, cell]); }
    for (const r of Object.keys(sh.rowH)) if (!rows.has(Number(r))) rows.set(Number(r), []);
    const body = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([r, cells]) => {
      const ht = sh.rowH[r];
      const cs = cells.sort((a, b) => a[0] - b[0]).map(([c, cell]) => {
        const ref = `${colName(c)}${r + 1}`, s = styleOf(cell.link ? { ...cell.s, u: true, color: cell.s?.color ?? '#0563c1' } : cell.s), sa = s ? ` s="${s}"` : '';
        if (cell.f !== undefined) anyFormula = true;
        const f = cell.f !== undefined ? `<f>${esc(clean(cell.f))}</f>` : '';
        const v = cell.v;
        if (v === null || v === '') return f ? `<c r="${ref}"${sa}>${f}</c>` : `<c r="${ref}"${sa}/>`;
        if (cell.err) return `<c r="${ref}"${sa} t="e">${f}<v>${esc(String(v))}</v></c>`;
        if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${sa}>${f}<v>${v}</v></c>` : `<c r="${ref}"${sa} t="e"><v>#NUM!</v></c>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${sa} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
        return f ? `<c r="${ref}"${sa} t="str">${f}<v>${esc(clean(v))}</v></c>` : `<c r="${ref}"${sa} t="s"><v>${sst(clean(v))}</v></c>`;
      }).join('');
      return `<row r="${r + 1}"${ht ? ` ht="${(ht * 0.75).toFixed(2)}" customHeight="1"` : ''}${hidden.has(r) ? ' hidden="1"' : ''}>${cs}</row>`;
    }).join('');
    const cols = Object.entries(sh.colW).sort((a, b) => Number(a[0]) - Number(b[0])).map(([c, w]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${Math.max(1, (w - 5) / 7).toFixed(2)}" customWidth="1"/>`).join('');
    const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${rangeText(m)}"/>`).join('')}</mergeCells>` : '';
    if (drawing || links.length) sheetRels.set(index, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawing ? `<Relationship Id="rId1" Type="${NS.rel}/drawing" Target="${drawing}"/>` : ''}${links.map((u, k) => `<Relationship Id="rId${k + 2}" Type="${NS.rel}/hyperlink" Target="${esc(u)}" TargetMode="External"/>`).join('')}</Relationships>`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS.main}" xmlns:r="${NS.rel}"><sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${paneXml(sh)}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData>${rx.filter}${merges}${rx.cf}${rx.dv}${rx.hl}${drawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
  };

  const zip = new JSZip();
  const sheets = book.sheets.length ? book.sheets : [emptySheet('Sheet1')];
  const chartParts = buildChartParts(sheets);
  for (const [path, xml] of Object.entries(chartParts.files)) zip.file(path, xml);
  sheets.forEach((sh, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh, i === book.active, chartParts.drawingOf.get(i), i)));
  for (const [i, xml] of sheetRels) zip.file(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, xml);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${chartParts.overrides.join('')}</Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS.main}" xmlns:r="${NS.rel}"><bookViews><workbookView activeTab="${Math.min(book.active, sheets.length - 1)}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(clean(s.name).slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${anyFormula ? '<calcPr fullCalcOnLoad="1"/>' : ''}</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS.main}">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borderList.length}">${borderList.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>${dxfList.length ? `<dxfs count="${dxfList.length}">${dxfList.join('')}</dxfs>` : ''}</styleSheet>`);
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${NS.main}" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
void colIndex;
