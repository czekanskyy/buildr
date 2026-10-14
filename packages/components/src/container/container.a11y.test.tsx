// @vitest-environment jsdom
import { createMemoryDataSource, s, type TreeNode } from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, render } from '../test-kit.tsx';
import { CONTAINER_ELEMENTS, Container } from './definition.ts';
import { containerFixtures } from './fixtures.ts';
import { containerMigrationFixtures } from './migration-fixtures.ts';

expect.extend(axeMatchers);

const registry = createRegistry({ components: [Page, Container, Probe] });
const data = createMemoryDataSource({ media: imageFixtureMedia });

const inPage = (...trees: TreeNode[]) =>
  doc(
    { type: 'buildr/page', children: trees as never },
    { components: { 'buildr/container': Container.meta.version } },
  );

const container = (props: Record<string, unknown>, children: TreeNode[] = []): TreeNode => ({
  type: 'buildr/container',
  props: props as never,
  children,
});

/** Runs axe over the markup in a neutral host; only page-level rules a fragment cannot meet are off. */
async function violations(html: string, extra: Record<string, { enabled: boolean }> = {}) {
  const host = window.document.createElement('div');
  host.innerHTML = html;
  window.document.body.replaceChildren(host);
  return axe(host, {
    rules: {
      // jsdom has no layout or stylesheet cascade, so colour contrast cannot be judged here.
      'color-contrast': { enabled: false },
      // A fixture is a fragment, not a whole page.
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
      region: { enabled: false },
      ...extra,
    },
  });
}

describe('buildr/container accessibility', () => {
  it.each(containerFixtures.map((f) => [f.id, f.tree] as const))(
    'has no axe violation: %s',
    async (_id, tree) => {
      const { html } = await render(registry, inPage(tree), data);
      expect(await violations(html)).toHaveNoViolations();
    },
  );

  it.each(containerMigrationFixtures.map((f) => [f.id, f.before] as const))(
    'has no axe violation once migrated: %s',
    async (_id, before) => {
      const { html } = await render(registry, before, data, {
        post: { cover: imageFixtureMedia.m1 },
      });
      expect(await violations(html)).toHaveNoViolations();
    },
  );

  describe('landmarks', () => {
    it('exposes one main, with the main landmark checks on', async () => {
      const { html } = await render(registry, inPage(container({ as: s('main') })));
      expect(
        await violations(html, { 'landmark-one-main': { enabled: true } }),
      ).toHaveNoViolations();
    });

    it('flags two main landmarks', async () => {
      const { html } = await render(
        registry,
        inPage(container({ as: s('main') }), container({ as: s('main') })),
      );
      const result = await violations(html, { 'landmark-no-duplicate-main': { enabled: true } });
      expect(result.violations.map((v) => v.id)).toContain('landmark-no-duplicate-main');
    });

    it('names two navigations apart', async () => {
      const { html } = await render(
        registry,
        inPage(
          container({ as: s('nav'), ariaLabel: s('Primary') }),
          container({ as: s('nav'), ariaLabel: s('Footer') }),
        ),
      );
      expect(await violations(html, { 'landmark-unique': { enabled: true } })).toHaveNoViolations();
    });

    it('flags two unnamed asides', async () => {
      const { html } = await render(
        registry,
        inPage(container({ as: s('aside') }), container({ as: s('aside') })),
      );
      const result = await violations(html, { 'landmark-unique': { enabled: true } });
      expect(result.violations.map((v) => v.id)).toContain('landmark-unique');
    });

    it.each(CONTAINER_ELEMENTS)(
      'has no violation as %s with a name and a role prop',
      async (as) => {
        const { html } = await render(
          registry,
          inPage(container({ as: s(as), role: s('group'), ariaLabel: s('Things') })),
        );
        expect(await violations(html)).toHaveNoViolations();
      },
    );
  });

  describe('roles of a plain div', () => {
    it('names a group', async () => {
      const { html } = await render(
        registry,
        inPage(
          container({ role: s('group'), ariaLabel: s('Contact options') }, [
            { type: 'test/probe' },
          ]),
        ),
      );
      expect(html).toContain('role="group"');
      expect(await violations(html)).toHaveNoViolations();
    });

    it('is a list', async () => {
      const { html } = await render(registry, inPage(container({ role: s('list') })));
      expect(html).toContain('role="list"');
      expect(await violations(html)).toHaveNoViolations();
    });
  });
});
