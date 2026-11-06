import type { HostCapabilities, RegistryManifest } from '@next-buildr/core';
import type { DocumentAdapter, DocumentRef } from '../persistence/types.ts';
import type { EditorStoreOptions } from '../store/types.ts';

export type { DocumentRef };

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
  /**
   * The narrowest window (in CSS pixels) the editor opens in; below it a notice asks the author to
   * use a wider screen. Defaults to 320 (the narrowest phone; the panels are sheets over the
   * canvas below 1100px); `0` turns the check off.
   */
  readonly minViewportWidth?: number;
  /**
   * What the host permits beyond the safe defaults (ADR-026). `authorCode: true` shows the Advanced
   * fields (custom CSS, classes, attributes) and the Text HTML mode and lets their commands run;
   * absent or anything but exactly `true` leaves them off. The `capabilities` prop of the editor wins.
   */
  readonly capabilities?: HostCapabilities;
}

export interface ResolvedEditorConfig {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly shortcuts: Readonly<Record<string, string>>;
  readonly autosave: { readonly debounceMs: number; readonly maxWaitMs: number };
  readonly uiLocale: string;
  readonly theme: 'light' | 'dark' | 'system';
  readonly minViewportWidth: number;
  readonly capabilities: HostCapabilities;
}

/** Below this window width the editor does not open: not even the toolbar and the canvas fit. */
export const DEFAULT_MIN_VIEWPORT_WIDTH = 320;

export const DEFAULT_BREAKPOINTS: readonly BreakpointConfig[] = [
  { id: 'desktop', width: 1280 },
  { id: 'tablet', width: 768 },
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
    minViewportWidth: config.minViewportWidth ?? DEFAULT_MIN_VIEWPORT_WIDTH,
    capabilities: config.capabilities ?? {},
  };
}

export interface BuilderEditorProps {
  /**
   * Loads, saves and publishes the document (`DocumentAdapter`, PB-087). The shell does not use it
   * yet; it is part of the mount API so hosts do not change when the panels arrive.
   */
  readonly adapter: DocumentAdapter;
  /** What the palette, the inspector and the rules know about the components (`toManifest`). */
  readonly manifest: RegistryManifest;
  /** The canvas route the iframe loads (`@next-buildr/react/canvas` runs there). */
  readonly canvasUrl: string;
  readonly documentRef: DocumentRef;
  readonly config?: EditorConfig;
  /** Host permissions (ADR-026); same as `config.capabilities`, and wins over it. Default: all off. */
  readonly capabilities?: HostCapabilities;
  /**
   * Decides whether the author may weaken a lock (`node.setAttr` `lock`), e.g. from the host's own
   * permission for template editing. Without it the editor can lock a block but never unlock it.
   * Read when an unlock is attempted, so it may close over current host state.
   */
  readonly canUnlock?: NonNullable<EditorStoreOptions['canUnlock']>;
  /**
   * The version history of the page. An address makes the toolbar's history icon a link; a function
   * is called when the icon is pressed (open your own panel or dialog). Without it, and without an
   * adapter `historyUrl(ref)`, there is no history icon. The prop wins over the adapter.
   */
  readonly historyUrl?: string | (() => void);
}
