import { niceAxis, PALETTE, shortNumber, type ChartData } from './charts.ts';
import type { Chart } from './model.ts';

const FG = 'hsl(var(--fg))', MUTED = 'hsl(var(--muted))', LINE = 'hsl(var(--line))';
const trim = (t: string, n: number) => (t.length > n ? `${t.slice(0, Math.max(1, n - 1))}…` : t);

/** A chart drawn as SVG (column, bar, line or pie) from its data; colours come from one fixed palette, text and grid from the theme's tokens. */
export function ChartView({ chart, data, w, h }: { chart: Pick<Chart, 'type' | 'title'>; data: ChartData; w: number; h: number }) {
  const { type } = chart;
  const pie = type === 'pie';
  const legend = pie ? data.cats.map((c, i) => ({ name: c, color: PALETTE[i % PALETTE.length] })) : data.series.map((s, i) => ({ name: s.name, color: PALETTE[i % PALETTE.length] }));
  const showLegend = pie ? data.cats.length > 0 : data.series.length > 1;
  const top = chart.title ? 38 : 14, bottom = showLegend ? 34 : 10;
  const all = data.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const axis = niceAxis(Math.min(0, ...all, 0), Math.max(0, ...all, 0));
  const horizontal = type === 'bar';
  const left = horizontal ? Math.min(150, 14 + Math.max(0, ...data.cats.map((c) => c.length)) * 6.5) : 14 + Math.max(...axis.ticks.map((t) => shortNumber(t).length), 1) * 7;
  const plot = { x: left, y: top, w: Math.max(20, w - left - 14), h: Math.max(20, h - top - bottom - (horizontal ? 18 : 22)) };
  const n = data.cats.length || 1;
  const scatter = type === 'scatter';
  const xs = data.cats.map((c, i) => { const v = Number(c); return c.trim() !== '' && Number.isFinite(v) ? v : i + 1; });
  const xAxis = niceAxis(Math.min(...xs, 0 + (xs.length ? Math.min(...xs) : 0)), Math.max(...xs, 1));
  const xPos = (v: number) => plot.x + ((v - xAxis.lo) / (xAxis.hi - xAxis.lo)) * plot.w;
  const scaleV = (v: number) => (horizontal ? plot.x + ((v - axis.lo) / (axis.hi - axis.lo)) * plot.w : plot.y + plot.h - ((v - axis.lo) / (axis.hi - axis.lo)) * plot.h);
  const empty = data.series.length === 0 || (pie ? false : all.length === 0);
  return (
    <svg width={w} height={h} role="img" aria-label={chart.title || `${type} chart`} style={{ display: 'block', fontSize: 12, fontFamily: 'inherit' }}>
      <rect width={w} height={h} fill="hsl(var(--bg))" />
      {chart.title && <text x={w / 2} y={24} textAnchor="middle" fontSize={15} fontWeight={600} fill={FG}>{trim(chart.title, Math.floor(w / 8))}</text>}
      {empty && <text x={w / 2} y={h / 2} textAnchor="middle" fill={MUTED}>No numbers in the data range</text>}
      {!empty && pie && <Pie data={data} cx={w / 2} cy={top + (h - top - bottom) / 2} r={Math.max(10, Math.min(w - 40, h - top - bottom - 10) / 2)} />}
      {!empty && !pie && (
        <g>
          {axis.ticks.map((t) => (horizontal
            ? <g key={t}><line x1={scaleV(t)} x2={scaleV(t)} y1={plot.y} y2={plot.y + plot.h} stroke={LINE} /><text x={scaleV(t)} y={plot.y + plot.h + 15} textAnchor="middle" fill={MUTED}>{shortNumber(t)}</text></g>
            : <g key={t}><line x1={plot.x} x2={plot.x + plot.w} y1={scaleV(t)} y2={scaleV(t)} stroke={LINE} /><text x={plot.x - 6} y={scaleV(t) + 4} textAnchor="end" fill={MUTED}>{shortNumber(t)}</text></g>))}
          {scatter && xAxis.ticks.map((t) => <g key={`x${t}`}><line x1={xPos(t)} x2={xPos(t)} y1={plot.y} y2={plot.y + plot.h} stroke={LINE} /><text x={xPos(t)} y={plot.y + plot.h + 15} textAnchor="middle" fill={MUTED}>{shortNumber(t)}</text></g>)}
          {!scatter && data.cats.map((c, i) => {
            const mid = (i + 0.5) / n;
            return horizontal
              ? <text key={i} x={plot.x - 6} y={plot.y + mid * plot.h + 4} textAnchor="end" fill={MUTED}>{trim(c, 22)}</text>
              : <text key={i} x={plot.x + mid * plot.w} y={plot.y + plot.h + 15} textAnchor="middle" fill={MUTED}>{trim(c, Math.max(3, Math.floor(plot.w / n / 7)))}</text>;
          })}
          {(type === 'column' || type === 'bar') && data.series.map((s, si) => s.values.map((v, i) => {
            if (v === null) return null;
            const slot = (horizontal ? plot.h : plot.w) / n, bw = (slot * 0.72) / data.series.length, start = i * slot + slot * 0.14 + si * bw;
            const base = scaleV(Math.max(axis.lo, Math.min(0, axis.hi))), at = scaleV(v);
            return horizontal
              ? <rect key={`${si}-${i}`} x={Math.min(base, at)} y={plot.y + start} width={Math.abs(at - base)} height={bw} fill={PALETTE[si % PALETTE.length]}><title>{`${s.name}, ${data.cats[i]}: ${v}`}</title></rect>
              : <rect key={`${si}-${i}`} x={plot.x + start} y={Math.min(base, at)} width={bw} height={Math.abs(at - base)} fill={PALETTE[si % PALETTE.length]}><title>{`${s.name}, ${data.cats[i]}: ${v}`}</title></rect>;
          }))}
          {scatter && data.series.map((s, si) => s.values.map((v, i) => v === null ? null : <circle key={`${si}-${i}`} cx={xPos(xs[i])} cy={scaleV(v)} r={4.5} fill={PALETTE[si % PALETTE.length]}><title>{`${s.name}: (${xs[i]}, ${v})`}</title></circle>))}
          {type === 'area' && data.series.map((s, si) => {
            const pts = s.values.map((v, i) => [plot.x + ((i + 0.5) / n) * plot.w, scaleV(v ?? 0)] as const);
            if (!pts.length) return null;
            const base = scaleV(Math.max(axis.lo, Math.min(0, axis.hi))), color = PALETTE[si % PALETTE.length];
            return <g key={si}><polygon points={`${pts[0][0]},${base} ${pts.map((p) => p.join(',')).join(' ')} ${pts[pts.length - 1][0]},${base}`} fill={color} fillOpacity={0.4} /><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" /></g>;
          })}
          {type === 'line' && data.series.map((s, si) => {
            const pts = s.values.map((v, i) => (v === null ? null : [plot.x + ((i + 0.5) / n) * plot.w, scaleV(v)] as const));
            const color = PALETTE[si % PALETTE.length];
            const segs: string[] = []; let cur: string[] = [];
            pts.forEach((p) => { if (p) cur.push(`${p[0]},${p[1]}`); else if (cur.length) { segs.push(cur.join(' ')); cur = []; } }); if (cur.length) segs.push(cur.join(' '));
            return <g key={si}>{segs.map((pl, i) => <polyline key={i} points={pl} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />)}{pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={color}><title>{`${s.name}, ${data.cats[i]}: ${s.values[i]}`}</title></circle>)}</g>;
          })}
          <line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke={MUTED} />
          <line x1={horizontal ? scaleV(Math.max(axis.lo, Math.min(0, axis.hi))) : plot.x} x2={horizontal ? scaleV(Math.max(axis.lo, Math.min(0, axis.hi))) : plot.x + plot.w} y1={horizontal ? plot.y : scaleV(Math.max(axis.lo, Math.min(0, axis.hi)))} y2={horizontal ? plot.y + plot.h : scaleV(Math.max(axis.lo, Math.min(0, axis.hi)))} stroke={MUTED} />
        </g>
      )}
      {showLegend && (
        <g transform={`translate(${w / 2 - legendWidth(legend.map((l) => l.name)) / 2}, ${h - 18})`}>
          {legendLayout(legend.map((l) => l.name)).map((p, i) => <g key={i} transform={`translate(${p.x}, 0)`}><rect width={10} height={10} y={-9} rx={2} fill={legend[i].color} /><text x={15} fill={FG}>{trim(legend[i].name, 18)}</text></g>)}
        </g>
      )}
    </svg>
  );
}

const itemWidth = (name: string) => 15 + Math.min(name.length, 18) * 6.6 + 16;
const legendLayout = (names: string[]) => { let x = 0; return names.map((n) => { const p = { x }; x += itemWidth(n); return p; }); };
const legendWidth = (names: string[]) => Math.min(names.reduce((a, n) => a + itemWidth(n), 0), 900);

function Pie({ data, cx, cy, r }: { data: ChartData; cx: number; cy: number; r: number }) {
  const vals = (data.series[0]?.values ?? []).map((v) => (v !== null && v > 0 ? v : 0));
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return <text x={cx} y={cy} textAnchor="middle" fill={MUTED}>No positive numbers in the data range</text>;
  let a0 = -Math.PI / 2;
  return (
    <g>
      {vals.map((v, i) => {
        if (!v) return null;
        const a1 = a0 + (v / total) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        const [x0, y0] = p(a0), [x1, y1] = p(a1), mid = (a0 + a1) / 2;
        const d = v === total ? `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0` : `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
        a0 = a1;
        return (
          <g key={i}>
            <path d={d} fill={PALETTE[i % PALETTE.length]} stroke="hsl(var(--bg))" strokeWidth={1.5}><title>{`${data.cats[i]}: ${v} (${Math.round((v / total) * 100)}%)`}</title></path>
            {v / total > 0.06 && <text x={cx + r * 0.62 * Math.cos(mid)} y={cy + r * 0.62 * Math.sin(mid) + 4} textAnchor="middle" fill="#fff" fontWeight={600}>{Math.round((v / total) * 100)}%</text>}
          </g>
        );
      })}
    </g>
  );
}

