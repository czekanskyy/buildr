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
 * drawn from plain shapes with fixed colours, so it needs no request and cannot carry script.
 */
export function thumbnail(blocks: readonly Block[]): string {
  const rects = blocks
    .map(([x, y, w, h, tone = 'line']) => {
      const radius = tone === 'action' ? 3 : 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${FILL[tone]}"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#f9fafb"/>${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
