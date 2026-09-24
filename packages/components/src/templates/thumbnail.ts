/** One block of a wireframe: `[x, y, width, height]` in a 160 x 100 picture, and how strong it is drawn. */
export type Block = readonly [
  x: number,
  y: number,
  w: number,
  h: number,
  tone?: 'line' | 'media' | 'action',
];

const FILL = { line: '#d1d5db', media: '#9ca3af', action: '#2563eb' } as const;

/**
 * A wireframe of a template as an SVG data URI (the `thumbnail` of a `TemplateDefinition`). It is
 * drawn from plain shapes with fixed colours, so it needs no request and cannot carry script. It
 * is kept small on purpose: thumbnails travel in the registry manifest, which has a size budget.
 * Blocks of one tone share a single path, and only the characters a data URI cannot hold are escaped.
 */
export function thumbnail(blocks: readonly Block[]): string {
  const layers = (Object.keys(FILL) as (keyof typeof FILL)[])
    .map((tone) => {
      const d = blocks
        .filter((block) => (block[4] ?? 'line') === tone)
        .map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`)
        .join('');
      return d === '' ? '' : `<path fill='${FILL[tone]}' d='${d}'/>`;
    })
    .join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'>${layers}</svg>`;
  return `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}`;
}
