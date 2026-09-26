'use client';

import type { CompileCache, Diagnostic, NodeId, PageNode, PreparedData } from '@next-buildr/core';
import {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { Platform } from '../define/types.ts';
import { renderNodeAt } from '../render/render-tree.ts';
import type { CanvasInstrumentation, RenderTreeOptions, ResumeState } from '../render/types.ts';
import { NodeBoundary } from './boundary.tsx';
import type { CanvasStore } from './store.ts';

/** Everything a node view needs besides its node. It changes only when something other than the document did. */
export interface CanvasEnv {
  readonly store: CanvasStore;
  readonly registry: ReactRegistry;
  readonly data: PreparedData;
  readonly platform: Platform;
  readonly messages?: Readonly<Record<string, string>>;
  readonly cache?: CompileCache;
  readonly instrument: CanvasInstrumentation;
  onNodeError(id: NodeId, error: unknown): void;
}

export const CanvasEnvContext = createContext<CanvasEnv | undefined>(undefined);

/** Two contexts that would resolve every prop the same: scopes compared per key, by identity first. */
function sameContext(a: ResumeState['context'], b: ResumeState['context']): boolean {
  if (a === b) return true;
  if (
    a.locale !== b.locale ||
    a.mode !== b.mode ||
    a.timeZone !== b.timeZone ||
    a.locales !== b.locales
  ) {
    return false;
  }
  const keys = Object.keys(a.scopes);
  if (keys.length !== Object.keys(b.scopes).length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(b.scopes, key)) return false;
    const x = a.scopes[key];
    const y = b.scopes[key];
    if (x !== y && JSON.stringify(x) !== JSON.stringify(y)) return false;
  }
  return true;
}

function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Whether a node found in the same place with the same surroundings would render the same. */
export function sameResume(a: ResumeState, b: ResumeState): boolean {
  return (
    sameContext(a.context, b.context) &&
    sameArray(a.instance, b.instance) &&
    sameArray(a.path, b.path) &&
    (a.parents === b.parents || JSON.stringify(a.parents) === JSON.stringify(b.parents))
  );
}

export interface NodeViewProps {
  readonly id: NodeId;
  readonly resume: ResumeState;
}

function Rendered({ node, resume }: { readonly node: PageNode; readonly resume: ResumeState }) {
  const env = useContext(CanvasEnvContext);
  if (env === undefined) throw new Error('NodeView must be rendered by a CanvasRuntime');
  const doc = env.store.getState().doc;
  const key = `${node.id}@${resume.instance.join('.')}`;

  const { tree, diagnostics } = useMemo(() => {
    const collected: Diagnostic[] = [];
    if (doc === undefined) return { tree: null as ReactNode, diagnostics: collected };
    const options: RenderTreeOptions = {
      registry: env.registry,
      data: env.data,
      context: resume.context,
      platform: env.platform,
      instrument: env.instrument,
      diagnostics: collected,
      ...(env.messages !== undefined ? { messages: env.messages } : {}),
      ...(env.cache !== undefined ? { cache: env.cache } : {}),
    };
    return { tree: renderNodeAt(doc, node.id, resume, options), diagnostics: collected };
  }, [doc, node, resume, env]);

  const { store } = env;
  useEffect(() => {
    store.setDiagnostics(key, diagnostics);
  }, [store, key, diagnostics]);
  useEffect(() => () => store.setDiagnostics(key, []), [store, key]);

  return <>{tree}</>;
}

/**
 * One node of the canvas, rendered on its own. It subscribes to its node alone, so an edit to a
 * node re-renders that node's view and no other: not its parent, which only holds this view as a
 * child, and not its siblings. Its parent passing it the same place again (same context, same
 * containers) does not re-render it either.
 */
export const NodeView = memo(
  function NodeView({ id, resume }: NodeViewProps) {
    const env = useContext(CanvasEnvContext);
    if (env === undefined) throw new Error('NodeView must be rendered by a CanvasRuntime');
    const { store } = env;
    const node = useSyncExternalStore(
      (listener) => store.subscribeNode(id, listener),
      () => store.getNode(id),
      () => store.getNode(id),
    );
    if (node === undefined) return null;
    return (
      <NodeBoundary nodeId={id} resetKey={node} onError={env.onNodeError}>
        <Rendered node={node} resume={resume} />
      </NodeBoundary>
    );
  },
  (prev, next) => prev.id === next.id && sameResume(prev.resume, next.resume),
);
