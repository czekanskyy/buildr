// Small text helpers shared by the serializers: bounded strings, lists and "did you mean".

/** Collapses whitespace and cuts `value` to `max` characters, marking the cut with an ellipsis. */
export function truncate(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1))}…`;
}

/** `value` as a JSON string literal, cut to `max` characters of content. */
export function quote(value: string, max = 40): string {
  return JSON.stringify(truncate(value, max));
}

/** "a, b and c" style list, capped at `limit` entries. */
export function list(values: readonly string[], limit = 12): string {
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')} (+${values.length - limit} more)`;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

/**
 * The candidates closest to `input` (case-insensitive, also matching by suffix after the
 * namespace slash), best first, at most `limit`. Empty when nothing is reasonably close.
 */
export function nearest(input: string, candidates: readonly string[], limit = 3): string[] {
  const needle = input.toLowerCase();
  const scored = candidates
    .map((candidate) => {
      const lower = candidate.toLowerCase();
      const bare = lower.slice(lower.indexOf('/') + 1);
      const d = Math.min(distance(needle, lower), distance(needle, bare));
      const contains = lower.includes(needle) || (needle.length > 2 && needle.includes(bare));
      return { candidate, score: contains ? Math.min(d, 1) : d };
    })
    .filter(({ candidate, score }) => score <= Math.max(2, Math.floor(candidate.length / 3)))
    .sort((x, y) => x.score - y.score || x.candidate.localeCompare(y.candidate));
  return scored.slice(0, limit).map(({ candidate }) => candidate);
}

/** Appends "Did you mean ...?" when there is a close candidate, else lists all valid options. */
export function suggest(input: string, candidates: readonly string[], noun: string): string {
  const close = nearest(input, candidates);
  if (close.length > 0) return `Did you mean ${close.map((c) => `"${c}"`).join(' or ')}?`;
  return candidates.length > 0
    ? `Valid ${noun}: ${list(candidates, 20)}.`
    : `There are no ${noun}.`;
}
