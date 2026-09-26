import type { PageNode } from '@next-buildr/core';
import { renderDocument } from '@next-buildr/react/server';
import type { ReactNode } from 'react';
import type { BuildrConfig, BuildrEntry } from './config.ts';
import { BuildrSectionBoundary } from './section-boundary.tsx';

export interface BuildrPageProps {
  readonly config: BuildrConfig;
  readonly entry: BuildrEntry;
  /** Rendered when the document cannot be used; by default the error is thrown for `error.tsx`. */
  readonly fallback?: ReactNode;
  /** Wrap each top-level section in an error boundary. Default: on in production. */
  readonly sectionBoundaries?: boolean;
}

const isProduction = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    'NODE_ENV'
  ] === 'production';

/** The ids of the root's direct children, read defensively: the document is not validated yet. */
function topLevelIds(document: unknown): ReadonlySet<string> {
  const nodes = (document as { nodes?: Record<string, PageNode | undefined> } | null)?.nodes;
  const ids = nodes?.['root']?.slots?.['default'];
  return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
}

/**
 * The production page (docs/nextjs.md): migrate, `prepareRender`, `compileStyles`, `renderTree` in
 * one async Server Component. Only `runtime: 'client'` components used on the page ship JavaScript.
 * A document that fails validation reaches `error.tsx` (or `fallback`); data problems are reported to
 * `config.onError` and rendering carries on.
 */
export async function BuildrPage({
  config,
  entry,
  fallback,
  sectionBoundaries = isProduction(),
}: BuildrPageProps) {
  const { context } = entry;
  const top = sectionBoundaries ? topLevelIds(entry.document) : new Set<string>();
  const messages = config.messages?.(context.locale);

  const result = await renderDocument(entry.document, {
    registry: config.registry,
    theme: config.theme,
    dataSource: await config.dataSource(context),
    context,
    platform: config.platform,
    ...(messages === undefined ? {} : { messages }),
    ...(entry.layoutRef ? { layoutRef: entry.layoutRef } : {}),
    ...(entry.currentId === undefined ? {} : { currentId: entry.currentId }),
    ...(config.cache === undefined ? {} : { cache: config.cache }),
    ...(top.size === 0
      ? {}
      : {
          instrument: {
            NodeView: ({ node, children }) =>
              top.has(node.id) ? (
                <BuildrSectionBoundary>{children}</BuildrSectionBoundary>
              ) : (
                children
              ),
          },
        }),
  });

  for (const diagnostic of result.diagnostics) {
    if (diagnostic.severity === 'error') config.onError?.(diagnostic);
  }
  if (result.element === null) {
    if (fallback !== undefined) return fallback;
    const error = new Error(
      `The Buildr document cannot be rendered: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
    config.onError?.(error);
    throw error;
  }
  return result.element;
}
