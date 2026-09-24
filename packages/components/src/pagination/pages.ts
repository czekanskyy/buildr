export type PageItem = { readonly kind: 'page'; readonly page: number } | { readonly kind: 'gap' };

const MAX_PAGES = 10_000;

/** A whole number within `[min, max]`; anything else (NaN, a string, a fraction) becomes `fallback`. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * The page numbers to show: the first, the last, and the current one with a neighbour either side,
 * with a gap where numbers are left out (`1 … 4 5 6 … 20`). Every page is shown when there are few.
 */
export function pageItems(page: number, totalPages: number): PageItem[] {
  const total = clampInt(totalPages, 0, MAX_PAGES, 1);
  const current = clampInt(page, 1, Math.max(total, 1), 1);
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: PageItem[] = [];
  let previous = 0;
  for (const n of pages) {
    if (n - previous === 2) out.push({ kind: 'page', page: previous + 1 });
    else if (n - previous > 2) out.push({ kind: 'gap' });
    out.push({ kind: 'page', page: n });
    previous = n;
  }
  return out;
}
