export type EditorSeed = 'empty' | 'landing';
export type EditorTheme = 'light' | 'dark';

export interface EditorRoute {
  /** A deterministic seed for the visual suite; `undefined` is the normal, `localStorage`-backed playground. */
  readonly seed: EditorSeed | undefined;
  readonly theme: EditorTheme | undefined;
  readonly uiLocale?: 'en' | 'pl';
}

/**
 * Reads `/?seed=empty|landing&theme=light|dark&uiLocale=en|pl`. The test suites use these: they
 * choose the document and the theme, and never change how the editor behaves. Unknown values are
 * ignored.
 */
export function parseEditorRoute(search: string): EditorRoute {
  const params = new URLSearchParams(search);
  const seed = params.get('seed');
  const theme = params.get('theme');
  const uiLocale = params.get('uiLocale');
  return {
    seed: seed === 'empty' || seed === 'landing' ? seed : undefined,
    theme: theme === 'light' || theme === 'dark' ? theme : undefined,
    ...(uiLocale === 'en' || uiLocale === 'pl' ? { uiLocale } : {}),
  };
}

/**
 * Whether the playground permits author code (ADR-026): on by default, `?authorCode=0` turns it
 * off. The editor and its canvas read the same query, so the preview matches the commands.
 */
export function authorCodeFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('authorCode') !== '0';
}
