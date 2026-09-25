import { readFileSync, writeFileSync } from 'node:fs';
import { defaultTheme, propertiesOfGroup, STYLE_GROUPS } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../backends/memory.ts';
import {
  loadDefaultManifest,
  loadDefaultRegistry,
} from '../serialize/default-manifest.test-kit.ts';
import { parseTreeInput } from '../serialize/tree-input.ts';
import { createSessionStore } from '../session/index.ts';
import { createBuildrTools } from '../tools/index.ts';
import { renderGuide } from './guide.ts';

const source = new URL('./guide.md', import.meta.url);
const generated = new URL('./guide-text.ts', import.meta.url);

/** One string literal per line, quoted the way the formatter would, so the diff stays readable. */
function quote(line: string): string {
  const mark = line.split("'").length > line.split('"').length ? '"' : "'";
  const escaped = line.replaceAll('\\', '\\\\').replaceAll(mark, `\\${mark}`);
  return `${mark}${escaped}${mark}`;
}

function toModule(markdown: string): string {
  const lines = markdown.replace(/\n$/, '').split('\n');
  const body = lines.map((line) => `  ${quote(line)},`).join('\n');
  const header =
    '// Generated from guide.md by UPDATE_MCP_DOCS=1 pnpm test --filter @buildr/mcp. Do not edit.';
  return `${header}\nexport const GUIDE_MARKDOWN = [\n${body}\n  '',\n].join('\\n');\n`;
}

const guide = readFileSync(source, 'utf8');

describe('the agent guide', () => {
  it('is embedded in guide-text.ts (UPDATE_MCP_DOCS=1 regenerates it)', () => {
    if (process.env['UPDATE_MCP_DOCS'] === '1') writeFileSync(generated, toModule(guide));
    expect(readFileSync(generated, 'utf8')).toBe(toModule(guide));
    expect(renderGuide()).toBe(guide);
  });

  it('covers what the card requires', () => {
    for (const topic of [
      'Page > Section > Container',
      'Templates or trees',
      'tokens and breakpoints',
      'bindings and formulas',
      'Localization',
      'Accessibility',
      'validate',
      'What never to do',
      'Never publish',
    ]) {
      expect(guide.toLowerCase()).toContain(topic.toLowerCase());
    }
  });

  it('only names components and templates that exist in the default catalogue', () => {
    const registry = loadDefaultRegistry();
    const known = new Set([
      ...registry.list().map((meta) => meta.type),
      ...registry.listTemplates().map((template) => template.id),
    ]);
    const mentioned = [...guide.matchAll(/(buildr\/[a-z][a-z-]*)/g)].map((m) => m[1] as string);
    expect(mentioned.length).toBeGreaterThan(10);
    for (const name of mentioned) expect(known.has(name), name).toBe(true);
    for (const id of [
      'buildr/hero',
      'buildr/feature-grid',
      'buildr/cta',
      'buildr/pricing',
      'buildr/faq',
      'buildr/contact',
      'buildr/blog-listing',
      'buildr/post-header',
      'buildr/product-hero',
    ]) {
      expect(known.has(id), id).toBe(true);
    }
  });

  it('only names tools that are registered', async () => {
    const backend = createMemoryBackend({
      manifest: loadDefaultManifest(),
      collections: ['pages'],
    });
    const tools = await createBuildrTools({
      store: createSessionStore({ backend }),
      backend,
      allowPublish: true,
    });
    const names = new Set(tools.map((tool) => tool.name));
    const mentioned = [...guide.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1] as string);
    expect(mentioned.length).toBeGreaterThan(15);
    for (const name of mentioned) expect(names.has(name), name).toBe(true);
    for (const name of ['undo', 'redo', 'validate', 'save', 'publish']) {
      expect(names.has(name), name).toBe(true);
      expect(guide).toContain(`\`${name}\``);
    }
  });

  it('only uses tokens, breakpoints and style properties the default theme and core know', () => {
    const tokens = [...guide.matchAll(/"\$([a-zA-Z]+)\.([a-z0-9-]+)"/g)];
    expect(tokens.length).toBeGreaterThan(8);
    for (const [, scale, name] of tokens) {
      const values = (defaultTheme.tokens as unknown as Record<string, Record<string, string>>)[
        scale as string
      ];
      expect(values?.[name as string], `$${scale}.${name}`).toBeDefined();
    }
    const breakpoints = new Set(defaultTheme.breakpoints.map((bp) => bp.id));
    for (const [, bp] of guide.matchAll(/"bp": "([a-z]+)"/g)) {
      expect(breakpoints.has(bp as string), bp).toBe(true);
    }
    for (const id of ['tablet', 'mobile']) expect(breakpoints.has(id)).toBe(true);
    const styles = [...guide.matchAll(/"group": "([a-z]+)", "property": "([A-Za-z]+)"/g)];
    expect(styles.length).toBeGreaterThan(2);
    for (const [, group, property] of styles) {
      expect(STYLE_GROUPS as readonly string[]).toContain(group);
      expect(
        propertiesOfGroup(group as (typeof STYLE_GROUPS)[number]).map((def) => def.name),
      ).toContain(property);
    }
  });

  it('has example trees that pass parseTreeInput', () => {
    const registry = loadDefaultRegistry();
    const trees = [...guide.matchAll(/```json tree\n([\s\S]*?)```/g)].map(
      (m) => JSON.parse(m[1] as string) as unknown,
    );
    expect(trees.length).toBeGreaterThanOrEqual(2);
    for (const tree of trees) {
      const parsed = parseTreeInput(registry, tree);
      expect(parsed.ok ? '' : parsed.error.message).toBe('');
    }
  });
});
