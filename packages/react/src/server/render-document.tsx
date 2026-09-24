import {
  type CompileCache,
  compileStyles,
  type DataContext,
  type DataSource,
  type Diagnostic,
  type DocumentLimits,
  prepareRender,
  type Theme,
} from '@buildr/core';
import type { ReactNode } from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { Platform } from '../define/types.ts';
import { loadDocument } from '../render/pipeline.ts';
import { renderTree } from '../render/render-tree.ts';
import { BuildrStyles } from '../render/styles.tsx';
import type { CanvasInstrumentation } from '../render/types.ts';

export interface RenderDocumentOptions {
  readonly registry: ReactRegistry;
  readonly theme: Theme;
  readonly dataSource: DataSource;
  readonly context: DataContext;
  readonly platform: Platform;
  readonly messages?: Readonly<Record<string, string>>;
  /** Which document the layout came from; forms use it to find their action. */
  readonly layoutRef?: string;
  /** The id of the document being rendered, so a query can exclude it (`excludeCurrent`). */
  readonly currentId?: string | number;
  readonly limits?: DocumentLimits;
  readonly cache?: CompileCache;
  readonly instrument?: CanvasInstrumentation;
}

export interface RenderDocumentResult {
  /** The stylesheet and the page; `null` when the document cannot be rendered (see `diagnostics`). */
  readonly element: ReactNode;
  readonly diagnostics: readonly Diagnostic[];
  /** The collections that were read: the cache tags to revalidate on. */
  readonly collectionsUsed: readonly string[];
  /** Set when a component is newer than this build knows; the document is not safe to edit. */
  readonly readOnlyReasons: readonly Diagnostic[];
}

/**
 * The production pipeline (docs/renderer.md#pipeline) as one async call:
 * `migrate -> validate -> prepareRender -> compileStyles -> renderTree`. Awaited in an RSC; the
 * result's `element` holds the `<style>` elements and the page. Never throws for data problems:
 * an unusable document gives `element: null` and the reasons in `diagnostics`, so the caller
 * decides between a 404 and an error page.
 */
export async function renderDocument(
  input: unknown,
  options: RenderDocumentOptions,
): Promise<RenderDocumentResult> {
  const loaded = loadDocument(input, options.registry, options.limits);
  const diagnostics: Diagnostic[] = [...loaded.diagnostics];
  const doc = loaded.doc;
  if (doc === undefined) {
    return {
      element: null,
      diagnostics,
      collectionsUsed: [],
      readOnlyReasons: loaded.readOnlyReasons,
    };
  }

  const prepared = await prepareRender(
    doc,
    options.registry.meta,
    options.context,
    options.dataSource,
    {
      ...(options.currentId !== undefined ? { currentId: options.currentId } : {}),
      ...(options.cache !== undefined ? { cache: options.cache } : {}),
    },
  );
  diagnostics.push(...prepared.diagnostics);

  const styles = compileStyles(doc, options.theme);
  diagnostics.push(...styles.diagnostics);

  const tree = renderTree(doc, {
    registry: options.registry,
    data: prepared,
    context: options.context,
    platform: options.platform,
    diagnostics,
    ...(options.messages !== undefined ? { messages: options.messages } : {}),
    ...(options.layoutRef !== undefined ? { layoutRef: options.layoutRef } : {}),
    ...(options.cache !== undefined ? { cache: options.cache } : {}),
    ...(options.instrument !== undefined ? { instrument: options.instrument } : {}),
  });

  return {
    element: (
      <>
        <BuildrStyles styles={styles} theme={options.theme} />
        {tree}
      </>
    ),
    diagnostics,
    collectionsUsed: prepared.collectionsUsed,
    readOnlyReasons: loaded.readOnlyReasons,
  };
}
