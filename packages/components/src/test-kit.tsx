// Shared by the component tests: build a document around a fixture, render it, and check it.
import {
  type BuilderDocument,
  createMemoryDataSource,
  type DataContext,
  type DataSource,
  type Diagnostic,
  defaultTheme,
  fromTree,
  registryVersions,
  runA11y,
  type TreeNode,
  validateDocument,
} from '@next-buildr/core';
import { createRegistry, defineComponent, type ReactRegistry } from '@next-buildr/react';
import { renderDocument } from '@next-buildr/react/server';
import { doc } from '@next-buildr/test-utils';
import { demoPlatform } from '@next-buildr/test-utils/demo/components';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentFixture } from './fixtures.ts';
import { createDefaultRegistry } from './registry.ts';

export const context: DataContext = {
  scopes: {},
  locale: 'en',
  locales: { default: 'en', fallback: true, intl: { en: 'English' } },
  timeZone: 'UTC',
  mode: 'production',
};

/** A leaf that prints its text, so container components have something to hold. */
export const Probe = defineComponent({
  type: 'test/probe',
  version: 1,
  label: 'Probe',
  category: 'content',
  contentCategories: ['flow'],
  props: {},
  styles: { groups: [] },
  runtime: 'shared',
  render: ({ root }) => createElement('p', root, 'probe'),
});

/** The versions the default registry serves, so fixtures are stored at the current version of each type. */
export const registryVersionsOfLibrary = registryVersions(createDefaultRegistry().meta);

/** A document whose page holds `tree`, every type stamped with the library's current version. */
export function pageWith(tree: TreeNode): BuilderDocument {
  return doc(
    { type: 'buildr/page', children: [tree as never] },
    { versions: registryVersionsOfLibrary },
  );
}

export interface Rendered {
  readonly html: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly document: BuilderDocument;
}

export async function render(
  registry: ReactRegistry,
  document: BuilderDocument,
  dataSource: DataSource = createMemoryDataSource(),
  scopes: DataContext['scopes'] = {},
): Promise<Rendered> {
  const result = await renderDocument(document, {
    registry,
    theme: defaultTheme,
    dataSource,
    context: { ...context, scopes },
    platform: demoPlatform,
  });
  const html = renderToStaticMarkup(createElement(Fragment, null, result.element as ReactNode));
  return { html, diagnostics: result.diagnostics, document };
}

/** Structural and accessibility problems of a fixture, blocking or not. Empty is the goal. */
export function problemsOf(registry: ReactRegistry, fixture: ComponentFixture): string[] {
  const document = pageWith(fixture.tree);
  const validated = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
  const a11y = runA11y(document, registry.meta, { theme: defaultTheme });
  return [
    ...validated.issues.map((i) => `${fixture.id}: ${i.code} ${i.message}`),
    ...a11y
      .filter((i) => i.severity === 'error')
      .map((i) => `${fixture.id}: ${i.ruleId} ${i.message}`),
  ];
}

export { createRegistry, fromTree };
