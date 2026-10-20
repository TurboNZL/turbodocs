import type JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { chartData, chartId, PALETTE } from './charts.ts';
import { cellAtPx, colIndex, colLeft, colName, rowTop, type Chart, type ChartType, type Range, type Sheet } from './model.ts';

/** Charts <-> the parts of an .xlsx (drawing + chart XML). Only column, bar, line and pie charts are kept; they are written with the numbers they show cached in them. */
const EMU = 9525;
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart', NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main', NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const q = (name: string) => `'${name.replace(/'/g, "''")}'`;
const abs = (c: number, r1: number, r2: number, c2 = c) => `$${colName(c)}$${r1 + 1}:$${colName(c2)}$${r2 + 1}`;

function chartXml(sh: Sheet, ch: Chart): string {
  const data = chartData(sh, ch);
  const { r1, c1, r2, c2 } = ch.range, first = ch.header ? r1 + 1 : r1, labels = ch.labels && c2 > c1, sc = labels ? c1 + 1 : c1;
  const name = q(sh.name);
  const strCache = (vals: string[]) => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(clean(v))}</c:v></c:pt>`).join('')}</c:strCache>`;
  const numCache = (vals: (number | null)[]) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => (v === null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache>`;
  const series = ch.type === 'pie' ? data.series.slice(0, 1) : data.series;
  const sers = series.map((s, i) => {
    const col = sc + i, color = PALETTE[i % PALETTE.length].slice(1).toUpperCase();
    const tx = ch.header ? `<c:tx><c:strRef><c:f>${esc(name)}!${abs(col, r1, r1)}</c:f>${strCache([s.name])}</c:strRef></c:tx>` : `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
    const fill = ch.type === 'line' ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:marker>` : ch.type === 'pie' ? '' : `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`;
    const dpts = ch.type === 'pie' ? data.cats.map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[k % PALETTE.length].slice(1).toUpperCase()}"/></a:solidFill></c:spPr></c:dPt>`).join('') : '';
    const cat = labels ? `<c:cat><c:strRef><c:f>${esc(name)}!${abs(c1, first, r2)}</c:f>${strCache(data.cats)}</c:strRef></c:cat>` : '';
    const val = `<c:val><c:numRef><c:f>${esc(name)}!${abs(col, first, r2)}</c:f>${numCache(s.values)}</c:numRef></c:val>`;
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${fill}${dpts}${cat}${val}${ch.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  }).join('');
  const horizontal = ch.type === 'bar';
  const ax = '<c:axId val="111111"/><c:axId val="222222"/>';
  const plot = ch.type === 'pie' ? `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`
    : ch.type === 'line' ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/>${ax}</c:lineChart>`
      : `<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="150"/>${ax}</c:barChart>`;
  const axes = ch.type === 'pie' ? '' : `<c:catAx><c:axId val="111111"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'b' : 'l'}"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111"/><c:crosses val="${horizontal ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  const title = ch.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(clean(ch.title))}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
  const legend = ch.type === 'pie' || series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function drawingXml(sh: Sheet, charts: Chart[]): string {
  const anchors = charts.map((ch, i) => {
    const at = cellAtPx(sh, ch.x, ch.y);
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${at.c}</xdr:col><xdr:colOff>${Math.round(at.dx * EMU)}</xdr:colOff><xdr:row>${at.r}</xdr:row><xdr:rowOff>${Math.round(at.dy * EMU)}</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(ch.w * EMU)}" cy="${Math.round(ch.h * EMU)}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors}</xdr:wsDr>`;
}

export interface ChartParts { files: Record<string, string>; overrides: string[]; /** sheet index -> its relationships file's content */ drawingOf: Map<number, string> }
export function buildChartParts(sheets: Sheet[]): ChartParts {
  const out: ChartParts = { files: {}, overrides: [], drawingOf: new Map() };
  let drawing = 0, chart = 0;
  const rels = (items: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
  sheets.forEach((sh, i) => {
    if (!sh.charts?.length) return;
    drawing++;
    const links: string[] = [];
    sh.charts.forEach((ch, k) => {
      chart++;
      out.files[`xl/charts/chart${chart}.xml`] = chartXml(sh, ch);
      out.overrides.push(`<Override PartName="/xl/charts/chart${chart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      links.push(`<Relationship Id="rId${k + 1}" Type="${NS_R}/chart" Target="../charts/chart${chart}.xml"/>`);
    });
    out.files[`xl/drawings/drawing${drawing}.xml`] = drawingXml(sh, sh.charts);
    out.files[`xl/drawings/_rels/drawing${drawing}.xml.rels`] = rels(links.join(''));
    out.overrides.push(`<Override PartName="/xl/drawings/drawing${drawing}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    out.files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = rels(`<Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawing${drawing}.xml"/>`);
    out.drawingOf.set(i, 'rId1');
  });
  return out;
}

// ---------------------------------------------------------------- reading
type El = Element;
const kids = (e: El | null | undefined, name?: string): El[] => (e ? ([...e.childNodes].filter((c) => c.nodeType === 1) as El[]).filter((c) => !name || c.localName === name) : []);
const desc = (e: El, name: string): El[] => [...e.getElementsByTagNameNS('*', name)];
const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml') as unknown as Document;
const resolve = (base: string, target: string): string => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/').slice(0, -1); for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); } return parts.join('/'); };
const relIdOf = (e: El) => e.getAttributeNS(NS_R, 'id') ?? e.getAttribute('r:id') ?? '';

interface Ref { sheet: string; c1: number; r1: number; c2: number; r2: number }
function parseRef(f: string | null | undefined): Ref | null {
  const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec((f ?? '').trim());
  if (!m) return null;
  const c1 = colIndex(m[3]), r1 = Number(m[4]) - 1;
  return { sheet: (m[1] ?? m[2]).replace(/''/g, "'"), c1, r1, c2: m[5] ? colIndex(m[5]) : c1, r2: m[6] ? Number(m[6]) - 1 : r1 };
}

/** The charts a worksheet's drawing holds that this app can show; what it cannot is named in `warnings`. */
export async function readCharts(zip: JSZip, sheetPath: string, ws: El, sheet: Sheet, warnings: Set<string>): Promise<void> {
  const text = async (p: string) => (await zip.file(p)?.async('string')) ?? null;
  const rid = kids(ws, 'drawing')[0];
  if (kids(ws, 'legacyDrawing')[0]) warnings.add('Comments.');
  if (!rid) return;
  const sheetRels = await text(sheetPath.replace(/([^/]+)$/, '_rels/$1.rels'));
  if (!sheetRels) return;
  const relOf = (xml: string, id: string) => kids(parse(xml).documentElement, 'Relationship').find((x) => x.getAttribute('Id') === id)?.getAttribute('Target') ?? '';
  const dTarget = relOf(sheetRels, relIdOf(rid));
  if (!dTarget) return;
  const dPath = resolve(sheetPath, dTarget);
  const dXml = await text(dPath);
  if (!dXml) return;
  const dRels = (await text(dPath.replace(/([^/]+)$/, '_rels/$1.rels'))) ?? '<Relationships/>';
  const root = parse(dXml).documentElement;
  const geom = (ak: El): { x: number; y: number; w: number; h: number } | null => {
    const pos = (m: El | undefined) => { const n = (t: string) => Number(kids(m, t)[0]?.textContent ?? 0); return m ? { c: n('col'), r: n('row'), dx: n('colOff') / EMU, dy: n('rowOff') / EMU } : null; };
    if (ak.localName === 'absoluteAnchor') { const p = kids(ak, 'pos')[0], e = kids(ak, 'ext')[0]; return p && e ? { x: Number(p.getAttribute('x')) / EMU, y: Number(p.getAttribute('y')) / EMU, w: Number(e.getAttribute('cx')) / EMU, h: Number(e.getAttribute('cy')) / EMU } : null; }
    const from = pos(kids(ak, 'from')[0]); if (!from) return null;
    const x = colLeft(sheet, from.c) + from.dx, y = rowTop(sheet, from.r) + from.dy;
    if (ak.localName === 'oneCellAnchor') { const e = kids(ak, 'ext')[0]; return e ? { x, y, w: Number(e.getAttribute('cx')) / EMU, h: Number(e.getAttribute('cy')) / EMU } : null; }
    const to = pos(kids(ak, 'to')[0]); if (!to) return null;
    return { x, y, w: Math.max(120, colLeft(sheet, to.c) + to.dx - x), h: Math.max(90, rowTop(sheet, to.r) + to.dy - y) };
  };
  for (const ak of kids(root).filter((k) => /Anchor$/.test(k.localName))) {
    if (desc(ak, 'pic')[0]) { warnings.add('Pictures.'); continue; }
    const cEl = desc(ak, 'chart')[0];
    if (!cEl) { warnings.add('Shapes and text boxes drawn on the sheet.'); continue; }
    const chPath = (() => { const t = relOf(dRels, relIdOf(cEl)); return t ? resolve(dPath, t) : ''; })();
    const chXml = chPath ? await text(chPath) : null;
    const g = geom(ak);
    if (!chXml || !g) { warnings.add('A chart could not be read.'); continue; }
    const ch = readChart(parse(chXml).documentElement, sheet, warnings);
    if (ch) sheet.charts = [...(sheet.charts ?? []), { ...ch, x: Math.round(g.x), y: Math.round(g.y), w: Math.max(120, Math.round(g.w)), h: Math.max(90, Math.round(g.h)) }];
  }
}

function readChart(root: El, sheet: Sheet, warnings: Set<string>): Omit<Chart, 'x' | 'y' | 'w' | 'h'> | null {
  const plot = desc(root, 'plotArea')[0];
  const group = plot && kids(plot).find((k) => /Chart$/.test(k.localName) && k.localName !== 'chart');
  if (!group) { warnings.add('A chart could not be read.'); return null; }
  const kind = group.localName;
  let type: ChartType;
  if (kind === 'barChart') type = kids(group, 'barDir')[0]?.getAttribute('val') === 'bar' ? 'bar' : 'column';
  else if (kind === 'lineChart') type = 'line';
  else if (kind === 'areaChart' || kind === 'scatterChart') { type = 'line'; warnings.add('Area and scatter charts are shown as line charts.'); }
  else if (kind === 'pieChart' || kind === 'doughnutChart') type = 'pie';
  else { warnings.add(`A ${kind.replace(/Chart$/, '')} chart is not shown (only column, bar, line and pie charts are).`); return null; }
  const sers = kids(group, 'ser');
  const refOf = (s: El, tag: string) => { const e = kids(s, tag)[0]; return e ? parseRef(desc(e, 'f')[0]?.textContent) : null; };
  const refs = sers.map((s) => ({ tx: refOf(s, 'tx'), cat: refOf(s, 'cat'), val: refOf(s, kind === 'scatterChart' ? 'yVal' : 'val') }));
  const vals = refs.map((r) => r.val);
  if (!vals.length || vals.some((v) => !v)) { warnings.add('A chart whose data is not in the sheet is not shown.'); return null; }
  const v = vals as Ref[];
  if (v.some((x) => x.sheet !== sheet.name)) { warnings.add('A chart that uses another sheet\'s data is not shown.'); return null; }
  if (v.some((x) => x.c1 !== x.c2 || x.r1 !== v[0].r1 || x.r2 !== v[0].r2) || v.length > 1 && v.some((x, i) => i > 0 && x.c1 !== v[i - 1].c1 + 1)) { warnings.add('A chart whose series are in rows, or in separated columns, is not shown.'); return null; }
  const first = v[0];
  const header = refs.every((r) => r.tx && r.tx.r1 === first.r1 - 1 && r.tx.c1 === r.val!.c1);
  const cat = refs[0].cat;
  const labels = !!cat && cat.sheet === sheet.name && cat.c1 === cat.c2 && cat.c1 === first.c1 - 1 && cat.r1 === first.r1 && cat.r2 === first.r2;
  const range: Range = { r1: header ? first.r1 - 1 : first.r1, c1: labels ? first.c1 - 1 : first.c1, r2: first.r2, c2: v[v.length - 1].c1 };
  const title = desc(desc(root, 'chart')[0] ?? root, 'title')[0];
  return { id: chartId(), type, title: title ? desc(title, 't').map((t) => t.textContent ?? '').join('') : '', range, header, labels };
}
