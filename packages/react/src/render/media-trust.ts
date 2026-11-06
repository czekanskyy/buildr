// Which media values the renderer resolved itself (ADR-028). A media prop in a stored document is
// author data: it can hold a `MediaRef`, an external `{ external: true, url }`, or any other object
// someone wrote into the JSON. Only an asset the renderer found in `PreparedData.media` (what the
// host's data source returned for a reference) is a library asset; the renderer marks exactly those,
// and a component treats every other object as untrusted. The mark is a symbol-keyed property:
// JSON from a document or an API cannot carry one, `JSON.stringify` and `Object.values` skip it
// (so the props still count as plain JSON), and a shallow copy keeps it.

const RESOLVED_MEDIA: unique symbol = Symbol.for('@next-buildr/react/resolved-media') as never;

/** Marks `asset` (an object the renderer built from prepared data) as a resolved library asset. Returns it. */
export function markResolvedMedia<T extends object>(asset: T): T {
  Object.defineProperty(asset, RESOLVED_MEDIA, {
    value: true,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  return asset;
}

/** Whether `value` is an asset the renderer resolved from prepared data (see `markResolvedMedia`). */
export function isResolvedMedia(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [RESOLVED_MEDIA]?: unknown })[RESOLVED_MEDIA] === true
  );
}
