import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Where the author's choice is remembered (per browser, not per document). */
export const THEME_STORAGE_KEY = 'buildr:theme';

export interface ThemeState {
  /** What the switch shows: the author's choice, `system` until they make one. */
  readonly preference: ThemePreference;
  /** The value for the root's `data-theme`: `system` leaves the attribute off. */
  readonly attribute: ThemePreference;
  /** The host fixed the theme (`config.theme`); the switch is hidden and the host's value wins. */
  readonly forced: boolean;
  readonly setPreference: (next: ThemePreference) => void;
}

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const read = (): ThemePreference => {
  try {
    const saved = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
};

const write = (value: ThemePreference) => {
  try {
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Private windows and blocked storage: the choice just is not remembered.
  }
};

/**
 * The editor's theme (docs/editor.md#toolbar-pb-083): the host's `config.theme` wins when it is
 * `light` or `dark`; otherwise the author's remembered choice applies, and follows the system
 * until they make one.
 */
export function useThemePreference(hostTheme: ThemePreference): ThemeState {
  const forced = hostTheme !== 'system';
  const [stored, setStored] = useState<ThemePreference>(read);
  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    write(next);
  }, []);
  return useMemo(
    () => ({
      preference: forced ? hostTheme : stored,
      attribute: forced ? hostTheme : stored,
      forced,
      setPreference,
    }),
    [forced, hostTheme, stored, setPreference],
  );
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export const ThemeProvider = ThemeContext.Provider;

/** The theme state of the enclosing editor; `undefined` outside one (the switch is then left out). */
export function useTheme(): ThemeState | undefined {
  return useContext(ThemeContext);
}
