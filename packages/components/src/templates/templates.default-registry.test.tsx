// @vitest-environment jsdom
import {
  instantiateTemplate,
  registryVersions,
  runA11y,
  validateDocument,
} from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { createGalleryDataSource, gallerySampleScopes } from '../gallery.ts';
import { createDefaultRegistry, defaultTemplates } from '../registry.ts';
import { render } from '../test-kit.tsx';
import { defaultTheme } from '../theme.ts';

expect.extend(axeMatchers);

const registry = createDefaultRegistry();
const versions = registryVersions(registry.meta);

const instances = defaultTemplates.flatMap((template) =>
  [undefined, ...Object.keys(template.variants ?? {})].map((variant) => ({
    name: `${template.id}${variant === undefined ? '' : ` (${variant})`}`,
    template,
    variant,
  })),
);

/** A page holding one instance of the template, stamped with the registry's versions. */
function documentOf({ template, variant }: (typeof instances)[number]) {
  const fragment = instantiateTemplate(template, variant, undefined, versions);
  const page = doc({ type: 'buildr/page' }, { versions });
  const pageNode = page.nodes[page.root];
  if (pageNode === undefined) throw new Error('no page');
  return {
    ...page,
    components: { ...page.components, ...fragment.components },
    nodes: {
      ...page.nodes,
      ...fragment.nodes,
      [page.root]: { ...pageNode, slots: { default: [...fragment.roots] } },
    },
  };
}

describe('every template, against the default registry', () => {
  it.each(instances.map((i) => [i.name, i] as const))(
    '%s is valid, accessible and current',
    async (_name, instance) => {
      const document = documentOf(instance);
      expect(document.components['buildr/container'] ?? 2).toBe(2);
      expect(Object.keys(document.components)).not.toContain('buildr/section');
      expect(Object.keys(document.components)).not.toContain('buildr/stack');

      const validated = validateDocument(document, {
        registry: registry.meta,
        theme: defaultTheme,
      });
      expect(validated.issues).toEqual([]);
      const a11y = runA11y(document, registry.meta, {
        theme: defaultTheme,
        config: { expectH1: 'document' },
      });
      expect(a11y.filter((i) => i.severity === 'error')).toEqual([]);

      const { html } = await render(
        registry,
        document,
        createGalleryDataSource(),
        gallerySampleScopes,
      );
      const host = window.document.createElement('main');
      host.innerHTML = html;
      window.document.body.replaceChildren(host);
      const results = await axe(host, {
        rules: {
          'color-contrast': { enabled: false },
          'page-has-heading-one': { enabled: false },
          'landmark-one-main': { enabled: false },
          'landmark-no-duplicate-main': { enabled: false },
          'landmark-unique': { enabled: false },
          region: { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    },
  );
});
