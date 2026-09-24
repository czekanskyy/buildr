'use client';

import {
  type CompileCache,
  compileStyles,
  type DataContext,
  type DataSource,
  type Diagnostic,
  type DocumentLimits,
  type PreparedData,
  prepareRender,
  type Theme,
} from '@buildr/core';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { Platform } from '../define/types.ts';
import { loadDocument } from '../render/pipeline.ts';
import { renderTree } from '../render/render-tree.ts';
import { BuildrStyles } from '../render/styles.tsx';
import type { CanvasInstrumentation } from '../render/types.ts';

export interface DocumentRendererProps {
  /** The stored document, in any schema version this build can migrate. */
  readonly document: unknown;
  readonly registry: ReactRegistry;
  readonly theme: Theme;
  readonly context: DataContext;
  readonly platform: Platform;
  /**
   * Data that was already prepared (by a server, or the canvas's host). Without it the renderer
   * asks `dataSource` on the client; with neither, nothing is prepared and media and queries are
   * absent.
   */
  readonly data?: PreparedData;
  readonly dataSource?: DataSource;
  readonly messages?: Readonly<Record<string, string>>;
  readonly currentId?: string | number;
  readonly limits?: DocumentLimits;
  readonly cache?: CompileCache;
  readonly instrument?: CanvasInstrumentation;
  /** Shown while a `dataSource` is being asked. */
  readonly fallback?: ReactNode;
  /** Called with everything worth reporting whenever the rendered output changes. */
  readonly onDiagnostics?: (diagnostics: readonly Diagnostic[]) => void;
}

const NO_DATA: PreparedData = { media: {}, queries: {}, collectionsUsed: [], diagnostics: [] };

/**
 * The single-page-app entry point: the same pipeline as `renderDocument`, run in the browser. It
 * takes either `PreparedData` or a `DataSource` (from which it prepares the data itself, showing
 * `fallback` meanwhile). Rendering is the same shared `renderTree`, so what it shows is what the
 * server would.
 */
export function DocumentRenderer(props: DocumentRendererProps) {
  const { document, registry, context, dataSource, currentId, cache, limits } = props;
  const loaded = useMemo(
    () => loadDocument(document, registry, limits),
    [document, registry, limits],
  );

  const [fetched, setFetched] = useState<{ doc: unknown; data: PreparedData } | undefined>();
  const needsFetch = props.data === undefined && dataSource !== undefined;

  useEffect(() => {
    const doc = loaded.doc;
    if (!needsFetch || doc === undefined || dataSource === undefined) return;
    let cancelled = false;
    prepareRender(doc, registry.meta, context, dataSource, {
      ...(currentId !== undefined ? { currentId } : {}),
      ...(cache !== undefined ? { cache } : {}),
    }).then((data) => {
      if (!cancelled) setFetched({ doc, data });
    });
    return () => {
      cancelled = true;
    };
  }, [needsFetch, loaded.doc, registry, context, dataSource, currentId, cache]);

  const data =
    props.data ??
    (needsFetch ? (fetched?.doc === loaded.doc ? fetched?.data : undefined) : NO_DATA);

  const rendered = useMemo(() => {
    const doc = loaded.doc;
    if (doc === undefined || data === undefined) return undefined;
    const diagnostics: Diagnostic[] = [...loaded.diagnostics, ...data.diagnostics];
    const styles = compileStyles(doc, props.theme);
    diagnostics.push(...styles.diagnostics);
    const tree = renderTree(doc, {
      registry,
      data,
      context,
      platform: props.platform,
      diagnostics,
      ...(props.messages !== undefined ? { messages: props.messages } : {}),
      ...(cache !== undefined ? { cache } : {}),
      ...(props.instrument !== undefined ? { instrument: props.instrument } : {}),
    });
    return { tree, styles, diagnostics };
  }, [
    loaded,
    data,
    registry,
    context,
    cache,
    props.theme,
    props.platform,
    props.messages,
    props.instrument,
  ]);

  const { onDiagnostics } = props;
  useEffect(() => {
    onDiagnostics?.(rendered?.diagnostics ?? loaded.diagnostics);
  }, [onDiagnostics, rendered, loaded.diagnostics]);

  if (rendered === undefined) return <>{loaded.doc === undefined ? null : props.fallback}</>;
  return (
    <>
      <BuildrStyles styles={rendered.styles} theme={props.theme} />
      {rendered.tree}
    </>
  );
}
