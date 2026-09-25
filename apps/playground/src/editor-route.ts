export type EditorSeed = 'empty' | 'landing';
export type EditorTheme = 'light' | 'dark';

export interface EditorRoute {
  /** A deterministic seed for the visual suite; `undefined` is the normal, `localStorage`-backed playground. */
  readonly seed: EditorSeed | undefined;
  readonly theme: EditorTheme | undefined;
}

/**
 * Reads `/?seed=empty|landing&theme=light|dark`. Only the visual suite (PB-118) uses these: they
 * choose the document and the theme, and never change how the editor behaves. Unknown values are
 * ignored.
 */
export function parseEditorRoute(search: string): EditorRoute {
  const params = new URLSearchParams(search);
  const seed = params.get('seed');
  const theme = params.get('theme');
  return {
    seed: seed === 'empty' || seed === 'landing' ? seed : undefined,
    theme: theme === 'light' || theme === 'dark' ? theme : undefined,
  };
}
