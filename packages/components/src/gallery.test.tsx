// @vitest-environment jsdom
import { runA11y, type TreeNode, validateDocument } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { createGalleryDataSource, galleryEntries, gallerySampleScopes } from './gallery.ts';
import { createDefaultRegistry } from './registry.ts';
import { pageWith, render } from './test-kit.tsx';
import { defaultTheme } from './theme.ts';

expect.extend(axeMatchers);

const registry = createDefaultRegistry();

/** An entry whose subtree holds a level-one heading is the page's headline. */
const headlineConfig = (tree: TreeNode) => {
  const holdsH1 = JSON.stringify(tree).includes('"level":{"kind":"static","value":1}');
  return holdsH1 ? { expectH1: 'document' as const } : {};
};

describe.each(galleryEntries.map((entry) => ({ id: entry.id, entry })))(
  'gallery: $id',
  ({ entry }) => {
    const document = pageWith(entry.tree);

    it('is a valid document', () => {
      const result = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
      expect(result.issues).toEqual([]);
    });

    it('has no accessibility error under the static validator', () => {
      const issues = runA11y(document, registry.meta, {
        theme: defaultTheme,
        config: headlineConfig(entry.tree),
      });
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('has no violation under axe, once server-rendered', async () => {
      const { html } = await render(
        registry,
        document,
        createGalleryDataSource(),
        gallerySampleScopes,
      );
      const container = window.document.createElement('main');
      container.innerHTML = html;
      window.document.body.replaceChildren(container);
      const results = await axe(container, {
        rules: {
          // jsdom has no layout or stylesheet cascade, so colour contrast cannot be judged here.
          'color-contrast': { enabled: false },
          // Page-level rules: a fixture is a fragment, not a whole page.
          'page-has-heading-one': { enabled: false },
          'landmark-one-main': { enabled: false },
          region: { enabled: false },
          'landmark-no-duplicate-main': { enabled: false },
          'landmark-unique': { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    });
  },
);
