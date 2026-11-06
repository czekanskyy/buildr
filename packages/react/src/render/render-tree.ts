import type { BuilderDocument, Diagnostic, HostCapabilities } from '@next-buildr/core';
import type { ReactNode } from 'react';
import { normalizeCapabilities } from './capabilities.ts';
import { renderChild, renderNode } from './render-node.ts';
import type { RenderRun, RenderTreeOptions, ResumeState } from './types.ts';

/** `process.env.NODE_ENV`, without requiring Node's types in a package that also runs in the browser. */
function inProduction(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.['NODE_ENV'] === 'production';
}

/** Fail closed: only the normalized capabilities reach the components' env; none means no key. */
function capabilitiesOf(options: RenderTreeOptions): { capabilities?: HostCapabilities } {
  const capabilities = normalizeCapabilities(options.capabilities);
  return Object.keys(capabilities).length > 0 ? { capabilities } : {};
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
      ...(options.layoutRef !== undefined ? { layoutRef: options.layoutRef } : {}),
      ...capabilitiesOf(options),
    },
    devChecks: options.devChecks ?? !inProduction(),
    path: new Set(),
    parents: [],
    instance: [],
    report: (diagnostics: readonly Diagnostic[]) => {
      if (sink !== undefined) for (const d of diagnostics) sink.push(d);
    },
  };
  return renderChild(doc.root, run);
}

/**
 * Renders one node on its own, from the state a lazy child was found in (docs/renderer.md, the
 * canvas). The node's children come back as `instrument.lazyChild` elements, so nothing below it
 * is walked; the node itself is not wrapped, since the caller is its view.
 */
export function renderNodeAt(
  doc: BuilderDocument,
  id: string,
  resume: ResumeState,
  options: RenderTreeOptions,
): ReactNode {
  const sink = options.diagnostics;
  const scoped: RenderTreeOptions = { ...options, context: resume.context };
  const run: RenderRun = {
    doc,
    options: scoped,
    env: {
      mode: scoped.context.mode,
      locale: scoped.context.locale,
      messages: scoped.messages ?? {},
      ...(scoped.layoutRef !== undefined ? { layoutRef: scoped.layoutRef } : {}),
      ...capabilitiesOf(scoped),
    },
    devChecks: scoped.devChecks ?? !inProduction(),
    path: new Set(resume.path),
    parents: [...resume.parents],
    instance: resume.instance,
    report: (diagnostics: readonly Diagnostic[]) => {
      if (sink !== undefined) for (const d of diagnostics) sink.push(d);
    },
  };
  return renderNode(id, run, true);
}
