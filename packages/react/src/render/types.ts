import type {
  CompileCache,
  DataContext,
  Diagnostic,
  PageNode,
  PreparedData,
  SlotName,
} from '@buildr/core';
import type { FunctionComponent, ReactNode } from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { NodeRoot, Platform } from '../define/types.ts';

/**
 * The hooks the canvas plugs into the one shared renderer (ADR-008). Everything here changes what
 * is *around* a component's output — attributes, wrappers, placeholders — never the output itself.
 */
export interface CanvasInstrumentation {
  /** Extra root attributes for a node (`data-bid`, …); merged over the generated ones. */
  rootAttributes?(node: PageNode): Partial<NodeRoot>;
  /** Wraps every rendered node (memoization, a per-node error boundary). Receives the element as `children`. */
  NodeView?: FunctionComponent<{ readonly node: PageNode; readonly children?: ReactNode }>;
  /** What to show for a node whose component is not registered; production renders nothing. */
  unknownComponent?(node: PageNode): ReactNode;
  /** What to show in a slot that has no children, so the author has something to drop onto. */
  emptySlot?(node: PageNode, slot: SlotName): ReactNode;
}

export interface RenderTreeOptions {
  readonly registry: ReactRegistry;
  /** Media and query results from `prepareRender`. */
  readonly data: PreparedData;
  /** Scopes, locale, time zone and mode the props are resolved against. */
  readonly context: DataContext;
  readonly platform: Platform;
  /** Canvas only. */
  readonly instrument?: CanvasInstrumentation;
  /** Built-in strings for `context.locale`, handed to every component as `env.messages`. */
  readonly messages?: Readonly<Record<string, string>>;
  /** Reuses parsed expressions across renders (a cache the caller owns). */
  readonly cache?: CompileCache;
  /**
   * Receives every problem met while rendering — prop resolution, missing media, unknown
   * components. Rendering never throws for data problems; it falls back and reports here.
   */
  readonly diagnostics?: Diagnostic[];
  /**
   * Asserts that what a `runtime: 'client'` component receives is serializable. Defaults to on
   * outside production.
   */
  readonly devChecks?: boolean;
}
