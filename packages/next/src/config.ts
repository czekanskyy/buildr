import type { CompileCache, DataContext, DataSource, Theme } from '@buildr/core';
import type { Platform, ReactRegistry } from '@buildr/react';

export interface BuildrConfigInput {
  readonly registry: ReactRegistry;
  readonly theme: Theme;
  readonly platform: Platform;
  /** Called per render, so it can be a per-request Payload Local API source. */
  readonly dataSource: (context: DataContext) => DataSource | Promise<DataSource>;
  /** Built-in strings for a language (`components/messages`); none by default. */
  readonly messages?: (locale: string) => Readonly<Record<string, string>> | undefined;
  /** Receives every problem met while rendering: error diagnostics and an unusable document. */
  readonly onError?: (error: unknown) => void;
  /** Reuses parsed expressions across renders. */
  readonly cache?: CompileCache;
}

export type BuildrConfig = Readonly<BuildrConfigInput>;

/** What `BuildrPage` renders: one resolved layout and the context it is rendered in. */
export interface BuildrEntry {
  /** The layout document, as stored (it is migrated and validated on render). */
  readonly document: unknown;
  readonly context: DataContext;
  /** `{collection}:{id}` of the document the layout came from (`layoutRef`); forms need it. */
  readonly layoutRef?: string | null;
  /** The id of the entry being rendered, so a query can exclude it. */
  readonly currentId?: string | number;
}

/** Bundles what rendering needs from the application (docs/nextjs.md) into one frozen object. */
export function createBuildrConfig(input: BuildrConfigInput): BuildrConfig {
  return Object.freeze({ ...input });
}
