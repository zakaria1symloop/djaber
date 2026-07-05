// Monochrome chart-kit number formatting helpers.
// Money is suffixed ' DA'; large values compact (12.9K / 4.2M), smaller values
// keep thousands separators. Never renders currency symbols or color.

function strip(v: number): string {
  // One decimal, drop a trailing ".0".
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
}

/** Compact a number: 4,200,000 -> "4.2M", 12,900 -> "12.9K", 3,420 -> "3,420". */
export function compact(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${strip(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}${strip(abs / 1_000)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Amount in Algerian dinar: "12.9K DA". */
export function fmtDA(n: number): string {
  return `${compact(n)} DA`;
}

/** Plain count, compacted for large values: "4.2M". */
export function fmtNum(n: number): string {
  return compact(n);
}
