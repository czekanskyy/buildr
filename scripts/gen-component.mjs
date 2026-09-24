#!/usr/bin/env node
// `pnpm gen:component <name> [--client] [--namespace buildr]` scaffolds a component directory in
// packages/components/src/<name>/ (docs/ai/component-development.md). The templates live here as
// `componentFiles`, a pure function, so the generator can be tested without touching the disk.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const pascal = (name) =>
  name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
const camel = (name) => {
  const p = pascal(name);
  return p[0].toLowerCase() + p.slice(1);
};
const words = (name) => name.split('-').join(' ');
const label = (name) => {
  const w = words(name);
  return w[0].toUpperCase() + w.slice(1);
};

/**
 * The files of a new component: relative path to content.
 * @param {string} name kebab-case component name, e.g. `pricing-table`
 * @param {{ client?: boolean, namespace?: string }} [options]
 * @returns {Record<string, string>}
 */
export function componentFiles(name, options = {}) {
  if (!NAME.test(name)) {
    throw new Error(
      `"${name}" is not a valid component name: use kebab-case, e.g. "pricing-table"`,
    );
  }
  const client = options.client === true;
  const namespace = options.namespace ?? 'buildr';
  if (!NAME.test(namespace)) throw new Error(`"${namespace}" is not a valid namespace`);
  const P = pascal(name);
  const c = camel(name);
  const view = client ? 'view.client.tsx' : 'view.tsx';
  const viewImport = client ? './view.client.tsx' : './view.tsx';
  const className = namespace === 'buildr' ? `bc-${name}` : `bc-${namespace}-${name}`;
  const propsType = client ? 'ClientComponentProps' : 'BuilderComponentProps';

  return {
    'props.ts': `import { p } from '@buildr/core';

/** The prop schema is its own module: the view is typed from it, and importing it from the definition would be a cycle. */
export const ${c}Props = {
  text: p.text({ default: '', bindable: true }),
} as const;
`,
    'definition.ts': `import { defineComponent } from '@buildr/react';
import { ${c}Props } from './props.ts';
import { ${P}View } from '${viewImport}';

/** ${label(name)}. Describe what it is for and what it is not. */
export const ${P} = defineComponent({
  type: '${namespace}/${name}',
  version: 1,
  label: '${label(name)}',
  category: 'content',
  icon: 'sparkles',
  contentCategories: ['flow'],
  props: ${c}Props,
  styles: { groups: ['spacing', 'typography', 'background', 'border'] },
  a11y: { element: 'div' },
  editor: { inlineProp: 'text' },
  runtime: '${client ? 'client' : 'shared'}',
  render: ${P}View,
});
`,
    [view]: `${client ? "'use client';\n\n" : ''}import type { ${propsType} } from '@buildr/react';
import type { ${c}Props } from './props.ts';

type Props = ${propsType}<typeof ${c}Props>;

/** Spreads \`root\` onto its single root element: that is what gives it its class and identity. */
export function ${P}View({ props, root }: Props) {
  return <div {...root}>{props.text}</div>;
}
`,
    'styles.css': `@layer buildr.components {
  .${className} {
    /* Tokens only: never a hard-coded colour. */
    color: inherit;
  }

  /* Anything interactive needs a visible focus style. */
  .${className}:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
}
`,
    'fixtures.ts': `import { s } from '@buildr/core';

/** Documents for the gallery and the tests: the default state, then one per notable prop combination. */
export const ${c}Fixtures = [
  {
    id: '${name}-default',
    title: '${label(name)}: default',
    props: { text: s('${label(name)}') },
  },
] as const;
`,
    [`${name}.test.tsx`]: `import { describe, expect, it } from 'vitest';
import { ${P} } from './definition.ts';

describe('${namespace}/${name}', () => {
  it('has complete metadata', () => {
    expect(${P}.meta.type).toBe('${namespace}/${name}');
    expect(${P}.meta.version).toBe(1);
    expect(${P}.meta.runtime).toBe('${client ? 'client' : 'shared'}');
  });

  // Add: an SSR snapshot, the root spread, prop validation, bindings for every bindable prop,
  // axe on the SSR output and keyboard behaviour (docs/ai/component-development.md).
});
`,
  };
}

async function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const client = argv.includes('--client');
  const nsIndex = argv.indexOf('--namespace');
  const namespace = nsIndex >= 0 ? argv[nsIndex + 1] : undefined;
  const name = args.find((a) => a !== namespace);
  if (name === undefined) {
    console.error('usage: pnpm gen:component <name> [--client] [--namespace <ns>]');
    process.exit(1);
  }
  const files = componentFiles(name, { client, ...(namespace !== undefined ? { namespace } : {}) });
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/components/src', name);
  if (existsSync(root)) {
    console.error(`${root} already exists; not overwriting it`);
    process.exit(1);
  }
  for (const [path, content] of Object.entries(files)) {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  console.log(`Created ${Object.keys(files).length} files in packages/components/src/${name}/`);
  console.log(
    'Next: fill in the definition, export it from src/index.ts, add it to docs/components.md.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
