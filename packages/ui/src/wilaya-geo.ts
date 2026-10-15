// Stylised map of the 69 wilayas of Algeria (no geodata dependency): each wilaya is the Voronoi cell of its chef-lieu
// clipped to a simplified national outline, in a projection that stretches the north (latitude ≥ 34° × 3) so the dense
// coastal wilayas stay readable and clickable. Pure functions, computed once (69 × 68 half-plane clips).
// Coordinates are approximate (± 0.1°): the map is a choropleth support, not a cadastral map.

type LatLng = readonly [lat: number, lng: number];
type Pt = readonly [x: number, y: number];

/** chef-lieu of each wilaya, by official code (1–69; 59–69: loi 26-06 of 2026) */
export const WILAYA_SEATS: Record<number, LatLng> = {
  1: [27.87, -0.29],
  2: [36.17, 1.33],
  3: [33.8, 2.88],
  4: [35.88, 7.11],
  5: [35.56, 6.17],
  6: [36.75, 5.08],
  7: [34.85, 5.73],
  8: [31.62, -2.22],
  9: [36.47, 2.83],
  10: [36.37, 3.9],
  11: [22.79, 5.52],
  12: [35.4, 8.12],
  13: [34.88, -1.32],
  14: [35.37, 1.32],
  15: [36.71, 4.05],
  16: [36.75, 3.06],
  17: [34.67, 3.25],
  18: [36.82, 5.77],
  19: [36.19, 5.41],
  20: [34.83, 0.15],
  21: [36.88, 6.91],
  22: [35.19, -0.63],
  23: [36.9, 7.77],
  24: [36.46, 7.43],
  25: [36.37, 6.61],
  26: [36.26, 2.75],
  27: [35.93, 0.09],
  28: [35.7, 4.54],
  29: [35.4, 0.14],
  30: [31.95, 5.33],
  31: [35.7, -0.63],
  32: [33.68, 1.02],
  33: [26.48, 8.47],
  34: [36.07, 4.76],
  35: [36.76, 3.48],
  36: [36.77, 8.31],
  37: [27.67, -8.15],
  38: [35.61, 1.81],
  39: [33.37, 6.86],
  40: [35.43, 7.14],
  41: [36.29, 7.95],
  42: [36.59, 2.45],
  43: [36.45, 6.26],
  44: [36.26, 1.97],
  45: [33.27, -0.31],
  46: [35.3, -1.14],
  47: [32.49, 3.67],
  48: [35.74, 0.56],
  49: [29.26, 0.24],
  50: [21.33, 0.95],
  51: [34.42, 5.06],
  52: [30.13, -2.17],
  53: [27.19, 2.47],
  54: [19.57, 5.77],
  55: [33.1, 6.06],
  56: [24.55, 9.48],
  57: [33.95, 5.92],
  58: [30.58, 2.88],
  59: [34.11, 2.1],
  60: [35.39, 5.37],
  61: [35.22, 5.71],
  62: [34.74, 8.06],
  63: [34.22, -1.26],
  64: [35.21, 2.32],
  65: [35.45, 2.9],
  66: [34.15, 3.5],
  67: [35.89, 2.75],
  68: [35.21, 4.17],
  69: [32.89, 0.55],
};

/** simplified national border, clockwise from the Moroccan border on the coast */
const OUTLINE: LatLng[] = [
  [35.1, -2.21],
  [35.1, -1.86],
  [35.3, -1.4],
  [35.78, -0.65],
  [36.0, 0.05],
  [36.35, 0.9],
  [36.52, 1.32],
  [36.6, 2.2],
  [36.82, 3.06],
  [36.92, 3.91],
  [36.8, 5.08],
  [36.86, 5.77],
  [37.08, 6.4],
  [36.95, 6.9],
  [36.98, 7.77],
  [36.9, 8.44],
  [36.95, 8.62],
  [36.45, 8.36],
  [35.9, 8.3],
  [35.2, 8.3],
  [34.6, 8.25],
  [34.1, 7.6],
  [33.5, 7.55],
  [33.1, 7.8],
  [32.4, 9.05],
  [31.4, 9.75],
  [30.24, 9.53],
  [29.0, 9.85],
  [27.9, 9.75],
  [26.5, 10.25],
  [25.4, 10.2],
  [24.7, 10.4],
  [24.2, 11.0],
  [23.52, 11.99],
  [22.0, 9.0],
  [20.8, 7.4],
  [19.3, 5.9],
  [19.14, 4.24],
  [18.97, 3.33],
  [19.7, 2.4],
  [20.3, 1.6],
  [21.0, 1.1],
  [21.5, 0.0],
  [22.3, -1.2],
  [23.4, -2.6],
  [24.3, -3.8],
  [25.0, -4.83],
  [26.0, -6.5],
  [27.29, -8.67],
  [28.7, -8.67],
  [29.3, -7.0],
  [29.8, -5.8],
  [30.3, -4.7],
  [30.9, -3.7],
  [31.5, -3.0],
  [32.1, -1.25],
  [32.7, -1.3],
  [33.5, -1.65],
  [34.3, -1.75],
  [34.8, -1.85],
];

const NORTH = 34;
const STRETCH = 3;
const TOP = 37.2;
const WEST = -9;
/** projection in map units (10 per degree of longitude) */
export function project([lat, lng]: LatLng): Pt {
  const y = lat >= NORTH ? (TOP - lat) * STRETCH : (TOP - NORTH) * STRETCH + (NORTH - lat);
  return [Math.round((lng - WEST) * 100) / 10, Math.round(y * 100) / 10];
}

/** Sutherland–Hodgman clip of `poly` by the half-plane a·x + b·y ≤ c */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const inside = (p: Pt) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const prev = poly[(i + poly.length - 1) % poly.length]!;
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const d = a * (cur[0] - prev[0]) + b * (cur[1] - prev[1]);
      const t = d === 0 ? 0 : (c - a * prev[0] - b * prev[1]) / d;
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
    if (ci) out.push(cur);
  }
  return out;
}

export type WilayaShape = { code: number; path: string; seat: Pt };
export type WilayaGeometry = {
  width: number;
  height: number;
  outline: string;
  shapes: WilayaShape[];
};

const toPath = (poly: Pt[]) =>
  poly.length ? `M${poly.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z` : '';

let cache: WilayaGeometry | null = null;
/** The 69 cells (computed once). */
export function wilayaGeometry(): WilayaGeometry {
  if (cache) return cache;
  const outline = OUTLINE.map(project);
  const seats = Object.entries(WILAYA_SEATS).map(([code, ll]) => ({
    code: Number(code),
    seat: project(ll),
  }));
  const shapes = seats.map(({ code, seat }) => {
    let cell: Pt[] = outline;
    for (const other of seats) {
      if (other.code === code || !cell.length) continue;
      const [sx, sy] = seat;
      const [ox, oy] = other.seat;
      // closer to `seat` than to `other`: 2 p·(o − s) ≤ |o|² − |s|²
      cell = clip(cell, 2 * (ox - sx), 2 * (oy - sy), ox * ox + oy * oy - sx * sx - sy * sy);
    }
    return { code, path: toPath(cell), seat };
  });
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  cache = {
    width: Math.ceil(Math.max(...xs)) + 2,
    height: Math.ceil(Math.max(...ys)) + 2,
    outline: toPath(outline),
    shapes,
  };
  return cache;
}

/** Sequential bucket (0 = no data, 1–5 light → dark) of a value against the max of the period. */
export function choroplethStep(value: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!value || value <= 0 || max <= 0) return 0;
  const r = value / max;
  return r > 0.8 ? 5 : r > 0.6 ? 4 : r > 0.4 ? 3 : r > 0.2 ? 2 : 1;
}
