import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, pageWith, problemsOf, render } from '../test-kit.tsx';
import { STACK_ROLES, Stack } from './definition.ts';
import { stackFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Stack, Probe] });

describe('buildr/stack', () => {
  it('renders one div with the root attributes and its children, no role by default', async () => {
    const { html } = await render(
      registry,
      pageWith({
        type: 'buildr/stack',
        children: [{ type: 'test/probe' }, { type: 'test/probe' }],
      }),
    );
    expect(html).toMatch(
      /<div class="bc-stack b-[^"]+"><p [^>]*>probe<\/p><p [^>]*>probe<\/p><\/div>/,
    );
    expect(html).not.toContain('role=');
  });

  it.each(STACK_ROLES.filter((r) => r !== 'none'))('supports the %s role', async (role) => {
    const { html } = await render(
      registry,
      pageWith({ type: 'buildr/stack', props: { role: s(role), ariaLabel: s('Things') } as never }),
    );
    expect(html).toContain(`role="${role}"`);
    expect(html).toContain('aria-label="Things"');
  });

  it('lets the axis follow the computed layout, so a responsive direction still drags correctly', () => {
    expect(Stack.meta.slots?.['default']?.axis).toBe('auto');
  });

  it('compiles the direction and its mobile override', async () => {
    const fixture = stackFixtures.find((f) => f.id === 'stack-row-to-column');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('flex-direction: row');
    expect(html).toContain('flex-direction: column');
    expect(html).toContain('@media');
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of stackFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Stack.meta))).toEqual(Stack.meta);
  });
});
