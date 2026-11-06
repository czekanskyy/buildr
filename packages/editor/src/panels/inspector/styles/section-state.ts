import { z } from 'zod';

const stateSchema = z.record(z.string(), z.boolean());
export const SECTIONS_STORAGE_KEY = 'buildr.editor.inspector.styles';

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => {
  for (const listener of listeners) listener();
};
export const subscribeSections = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// --- remembered open/closed state (outside the document) ---------------------------------------
let raw: string | null | undefined;
let remembered: Readonly<Record<string, boolean>> = {};

/** Corrupt or foreign data is ignored as a whole. */
function parse(text: string | null): Record<string, boolean> {
  if (text === null) return {};
  try {
    const parsed = stateSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** A stable snapshot: the same object until the stored text changes. */
export function rememberedSections(): Readonly<Record<string, boolean>> {
  let stored: string | null;
  try {
    stored = localStorage.getItem(SECTIONS_STORAGE_KEY);
  } catch {
    return remembered;
  }
  if (stored !== raw) {
    raw = stored;
    remembered = parse(stored);
  }
  return remembered;
}

function remember(next: Readonly<Record<string, boolean>>): void {
  remembered = next;
  try {
    localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next));
    raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
  } catch {
    // Private browsing and full storage still allow in-memory preferences.
  }
  notify();
}

export function setSectionOpen(name: string, open: boolean): void {
  remember({ ...rememberedSections(), [name]: open });
}

// --- the sections on screen, for expand all / collapse all -------------------------------------
export interface SectionsSnapshot {
  readonly names: readonly string[];
  readonly allOpen: boolean;
}

/** The sections mounted under one inspector; every editor on a page has its own. */
export interface SectionRegistry {
  readonly subscribe: (listener: Listener) => () => void;
  readonly snapshot: () => SectionsSnapshot;
  /** A section reports whether it is open; the returned function removes it. */
  readonly report: (name: string, open: boolean) => () => void;
}

export function createSectionRegistry(): SectionRegistry {
  const mounted = new Map<string, boolean>();
  const own = new Set<Listener>();
  let snapshot: SectionsSnapshot = { names: [], allOpen: false };
  const refresh = () => {
    const names = [...mounted.keys()];
    const allOpen = names.length > 0 && [...mounted.values()].every(Boolean);
    if (allOpen === snapshot.allOpen && names.join(',') === snapshot.names.join(',')) return;
    snapshot = { names, allOpen };
    for (const listener of [...own]) listener();
  };
  return {
    subscribe: (listener) => {
      own.add(listener);
      return () => {
        own.delete(listener);
      };
    },
    snapshot: () => snapshot,
    report: (name, open) => {
      mounted.set(name, open);
      refresh();
      return () => {
        mounted.delete(name);
        refresh();
      };
    },
  };
}

/** Expand or collapse every section of one registry, as one remembered change. */
export function setAllSections(registry: SectionRegistry, open: boolean): void {
  const next = { ...rememberedSections() };
  for (const name of registry.snapshot().names) next[name] = open;
  remember(next);
}
