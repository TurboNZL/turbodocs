import type { Geometry } from './model.ts';

/** The outline of a preset shape drawn into a w x h box (SVG path data). Rectangles, rounded rectangles and ellipses are plain CSS boxes and have none. */
export const SVG_GEOMETRIES: Geometry[] = ['triangle', 'diamond', 'hexagon', 'star5', 'rightArrow', 'leftArrow'];
export const isSvgShape = (g: Geometry | undefined): boolean => !!g && SVG_GEOMETRIES.includes(g);

const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' L')} Z`;

export function shapePath(g: Geometry, w: number, h: number): string {
  switch (g) {
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'hexagon': return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case 'rightArrow': return poly([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]);
    case 'leftArrow': return poly([[w, h * 0.3], [w * 0.4, h * 0.3], [w * 0.4, 0], [0, h / 2], [w * 0.4, h], [w * 0.4, h * 0.7], [w, h * 0.7]]);
    case 'star5': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * (Math.PI / 180), k = i % 2 ? 0.382 : 1; pts.push([w / 2 + (w / 2) * k * Math.cos(a), h / 2 + (h / 2) * k * Math.sin(a)]); }
      return poly(pts);
    }
    default: return `M0,0 H${w} V${h} H0 Z`;
  }
}

export const GEOMETRY_LABELS: Record<Geometry, string> = { rect: 'Rectangle', roundRect: 'Rounded rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star5: 'Star', rightArrow: 'Arrow right', leftArrow: 'Arrow left' };
