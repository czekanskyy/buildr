const cache = new Map<string, Intl.DisplayNames | null>();

function names(uiLocale: string): Intl.DisplayNames | null {
  const cached = cache.get(uiLocale);
  if (cached !== undefined) return cached;
  let created: Intl.DisplayNames | null = null;
  try {
    created = new Intl.DisplayNames([uiLocale], { type: 'language' });
  } catch {
    created = null; // an unknown interface language tag
  }
  cache.set(uiLocale, created);
  return created;
}

/**
 * The name of a content language ("angielski" for `en` in a Polish interface), from the
 * interface language's own data. `fallback` (the name the locale config gave, else the code)
 * stands in for a code the runtime has no name for.
 */
export function localeName(code: string, uiLocale: string, fallback?: string): string {
  try {
    const name = names(uiLocale)?.of(code);
    if (name !== undefined && name !== code) return name;
  } catch {
    // an invalid language tag: use the fallback
  }
  return fallback ?? code;
}
