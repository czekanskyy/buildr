import type { BuilderDocument, Diagnostic } from '@buildr/core';
import type { ReactNode } from 'react';
import { renderNode } from './render-node.ts';
import type { RenderRun, RenderTreeOptions } from './types.ts';

/** `process.env.NODE_ENV`, without requiring Node's types in a package that also runs in the browser. */
function inProduction(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.['NODE_ENV'] === 'production';
}

/**
 * Renders a document to React elements (docs/renderer.md, ADR-008). One function serves the
 * production site and the editor's canvas; the canvas passes `instrument` and nothing else
 * differs. Synchronous: everything asynchronous — media, queries — was done by `prepareRender`
 * and arrives as `options.data`.
 *
 * Never throws for data problems. A prop that cannot be resolved falls back to its default, an
 * unknown component renders nothing (or the canvas's placeholder), and each problem is pushed
 * onto `options.diagnostics`.
 */
export function renderTree(doc: BuilderDocument, options: RenderTreeOptions): ReactNode {
  const sink = options.diagnostics;
  const run: RenderRun = {
    doc,
    options,
    env: {
      mode: options.context.mode,
      locale: options.context.locale,
      messages: options.messages ?? {},
    },
    devChecks: options.devChecks ?? !inProduction(),
    path: new Set(),
    instance: [],
    report: (diagnostics: readonly Diagnostic[]) => {
      if (sink !== undefined) for (const d of diagnostics) sink.push(d);
    },
  };
  return renderNode(doc.root, run);
}
