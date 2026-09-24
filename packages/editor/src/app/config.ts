import type { RegistryManifest } from '@buildr/core';

/** One canvas width the toolbar offers (PB-083). */
export interface BreakpointConfig {
  readonly id: string;
  readonly width: number;
}

export interface EditorConfig {
  /** The widths of the canvas the author can switch between. */
  readonly breakpoints?: readonly BreakpointConfig[];
  /** Overrides for keyboard shortcuts, by action id (PB-084). */
  readonly shortcuts?: Readonly<Record<string, string>>;
  readonly autosave?: {
    /** Save after this long without a change. */
    readonly debounceMs: number;
    /** But at the latest this long after the first unsaved change. */
    readonly maxWaitMs: number;
  };
  /** The language of the editor's own interface (not the content's). */
  readonly uiLocale?: string;
  /** Forces a colour scheme; by default it follows the system's. */
  readonly theme?: 'light' | 'dark' | 'system';
}

export interface ResolvedEditorConfig {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly shortcuts: Readonly<Record<string, string>>;
  readonly autosave: { readonly debounceMs: number; readonly maxWaitMs: number };
  readonly uiLocale: string;
  readonly theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_BREAKPOINTS: readonly BreakpointConfig[] = [
  { id: 'desktop', width: 1280 },
  { id: 'tablet', width: 820 },
  { id: 'mobile', width: 390 },
];

/** Fills in what a host left out. */
export function resolveConfig(config: EditorConfig = {}): ResolvedEditorConfig {
  return {
    breakpoints: config.breakpoints ?? DEFAULT_BREAKPOINTS,
    shortcuts: config.shortcuts ?? {},
    autosave: config.autosave ?? { debounceMs: 2000, maxWaitMs: 20_000 },
    uiLocale: config.uiLocale ?? 'en',
    theme: config.theme ?? 'system',
  };
}

/** Which document the editor opens: a collection and an id in the host's backend. */
export interface DocumentRef {
  readonly collection: string;
  readonly id: string | number;
}

export interface BuilderEditorProps {
  /**
   * Loads, saves and publishes the document (`DocumentAdapter`, PB-087). The shell does not use it
   * yet; it is part of the mount API so hosts do not change when the panels arrive.
   */
  readonly adapter: object;
  /** What the palette, the inspector and the rules know about the components (`toManifest`). */
  readonly manifest: RegistryManifest;
  /** The canvas route the iframe loads (`@buildr/react/canvas` runs there). */
  readonly canvasUrl: string;
  readonly documentRef: DocumentRef;
  readonly config?: EditorConfig;
}
