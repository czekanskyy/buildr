import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRegistry } from '@buildr/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { componentFiles } from '../../../scripts/gen-component.mjs';
import { conventionProblems } from './conventions.test-kit.ts';

const GENERATED = new URL('./__generated__/', import.meta.url);

afterAll(() => rmSync(GENERATED, { recursive: true, force: true }));

function write(name: string, options?: { client?: boolean }): Record<string, string> {
  const files = componentFiles(name, options);
  const dir = new URL(`${name}/`, GENERATED);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) writeFileSync(new URL(path, dir), content);
  return files;
}

describe('component conventions', () => {
  it('holds for every component directory in the package', () => {
    const base = new URL('./', import.meta.url);
    const problems: string[] = [];
    for (const name of readdirSync(base)) {
      const dir = new URL(`${name}/`, base);
      if (name.startsWith('__') || !existsSync(new URL('definition.ts', dir))) continue;
      const files = Object.fromEntries(
        readdirSync(dir).map((file) => [file, readFileSync(new URL(file, dir), 'utf8')]),
      );
      problems.push(...conventionProblems(name, files));
    }
    expect(problems).toEqual([]);
  });

  it('flags a client component without a client view, and a client module in a shared one', () => {
    const shared = componentFiles('probe');
    const client = componentFiles('probe', { client: true });
    expect(conventionProblems('probe', shared)).toEqual([]);
    expect(conventionProblems('probe', client)).toEqual([]);

    const noClientView = Object.fromEntries(
      Object.entries(client).filter(([file]) => file !== 'view.client.tsx'),
    );
    expect(conventionProblems('probe', noClientView)).toContain(
      "probe: runtime 'client' needs view.client.tsx",
    );
    const noDirective = { ...client, 'view.client.tsx': 'export const x = 1;\n' };
    expect(conventionProblems('probe', noDirective)).toContain(
      "probe: view.client.tsx must start with 'use client'",
    );
    const leaked = { ...shared, 'view.tsx': `'use client';\n${shared['view.tsx']}` };
    expect(conventionProblems('probe', leaked)).toContain('probe: view.tsx is a client module');
  });
});

describe('gen-component', () => {
  it.each([
    ['shared', {}],
    ['client', { client: true }],
  ])('scaffolds a %s component that follows the conventions and works', async (_kind, options) => {
    const name = `gen-${_kind}-box`;
    const files = write(name, options);
    expect(conventionProblems(name, files)).toEqual([]);

    const module = (await import(
      /* @vite-ignore */ `./__generated__/${name}/definition.ts`
    )) as Record<string, { meta: { type: string; runtime: string } }>;
    const exported = Object.values(module).find((v) => typeof v === 'object' && 'meta' in v);
    expect(exported?.meta.type).toBe(`buildr/${name}`);
    expect(exported?.meta.runtime).toBe(_kind);

    const registry = createRegistry({ components: [exported as never] });
    expect(registry.has(`buildr/${name}`)).toBe(true);
    const Render = registry.get(`buildr/${name}`)?.render as never;
    const html = renderToStaticMarkup(
      createElement(Render, {
        props: { text: 'Hi' },
        root: { className: `bc-${name} b-x` },
        slots: {},
        node: { id: 'x', type: `buildr/${name}` },
        env: { mode: 'production', locale: 'en', messages: {} },
      }),
    );
    expect(html).toBe(`<div class="bc-${name} b-x">Hi</div>`);
  });

  it('honours a namespace', () => {
    const files = componentFiles('pricing-table', { namespace: 'acme' });
    expect(files['definition.ts']).toContain("type: 'acme/pricing-table'");
    expect(files['styles.css']).toContain('.bc-acme-pricing-table');
  });

  it.each(['', 'Foo', 'foo_bar', '1foo', 'foo--bar', '../x', 'foo/bar'])(
    'rejects the name %j',
    (name) => {
      expect(() => componentFiles(name)).toThrow(/not a valid component name/);
    },
  );
});
