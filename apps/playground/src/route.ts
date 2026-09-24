export interface GalleryRoute {
  /** The fixture to show; `undefined` shows the index of all fixtures. */
  readonly fixture: string | undefined;
  /** Width of the preview frame in CSS pixels; `undefined` fills the window. */
  readonly width: number | undefined;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 4000;

/** Reads `/gallery?fixture=<id>&w=<px>`. Bad values are ignored rather than trusted. */
export function parseGalleryRoute(search: string): GalleryRoute {
  const params = new URLSearchParams(search);
  const fixture = params.get('fixture') || undefined;
  const raw = params.get('w');
  const parsed = raw !== null && /^\d{1,5}$/.test(raw) ? Number(raw) : Number.NaN;
  const width =
    Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH ? parsed : undefined;
  return { fixture, width };
}

export function galleryHref(route: Partial<GalleryRoute>): string {
  const params = new URLSearchParams();
  if (route.fixture !== undefined) params.set('fixture', route.fixture);
  if (route.width !== undefined) params.set('w', String(route.width));
  const query = params.toString();
  return query === '' ? '/gallery' : `/gallery?${query}`;
}
