import type {
  BuilderDocument,
  CompileCache,
  DataContext,
  Diagnostic,
  NodeId,
  PageNode,
  PreparedData,
  SlotName,
} from '@buildr/core';
import type { FunctionComponent, ReactNode } from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { ComponentEnv, NodeParent, NodeRoot, Platform } from '../define/types.ts';

/**
 * The hooks the canvas plugs into the one shared renderer (ADR-008). Everything here changes what
 * is *around* a component's output — attributes, wrappers, placeholders — never the output itself.
 */
/**
 * Everything needed to render a node later, on its own: where it was found (its containers, the
 * loop instance it is part of and the scopes that instance sees). The canvas keeps one per node so
 * a change to a node re-renders that node and nothing around it.
 */
export interface ResumeState {
  readonly context: DataContext;
  readonly instance: readonly number[];
  readonly parents: readonly NodeParent[];
  readonly path: readonly NodeId[];
}

export interface CanvasInstrumentation {
  /**
   * Renders a child lazily: instead of walking into `node`, the renderer asks for an element that
   * will render it when React gets to it (the canvas's per-node view). With this set, `NodeView` is
   * not used: the element returned here is the wrapper.
   */
  lazyChild?(node: PageNode, resume: ResumeState): ReactNode;
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
  /** Which document the layout came from (`layoutRef`): what a form's action needs to find its form. */
  readonly layoutRef?: string;
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

/** Everything one render walk shares. Plain data and functions: no React context, no hooks. */
export interface RenderRun {
  readonly doc: BuilderDocument;
  readonly options: RenderTreeOptions;
  readonly env: ComponentEnv;
  readonly devChecks: boolean;
  /** The nodes between the root and the one being rendered, to stop a cyclic document. */
  readonly path: Set<NodeId>;
  /** The containers of the node being rendered, outermost first (its last entry is its parent). */
  readonly parents: NodeParent[];
  /** The loop iteration indices this node is inside, outermost first; empty outside any loop. */
  readonly instance: readonly number[];
  report(diagnostics: readonly Diagnostic[]): void;
}
