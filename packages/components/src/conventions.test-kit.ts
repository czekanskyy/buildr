/** The layout rules of a component directory (docs/ai/component-development.md), as checks on file contents. */
export function conventionProblems(
  name: string,
  files: Readonly<Record<string, string>>,
): string[] {
  const problems: string[] = [];
  const definition = files['definition.ts'];
  if (definition === undefined) return [`${name}: definition.ts is missing`];

  const client = /runtime:\s*'client'/.test(definition);
  if (/^\s*['"]use client['"]/.test(definition)) {
    problems.push(`${name}: definition.ts must not be a client module`);
  }
  if (client) {
    const view = files['view.client.tsx'];
    if (view === undefined) problems.push(`${name}: runtime 'client' needs view.client.tsx`);
    else if (!/^\s*['"]use client['"]/.test(view)) {
      problems.push(`${name}: view.client.tsx must start with 'use client'`);
    }
    if (files['view.tsx'] !== undefined)
      problems.push(`${name}: a client component has no view.tsx`);
  } else {
    if (files['view.tsx'] === undefined) problems.push(`${name}: view.tsx is missing`);
    if (files['view.client.tsx'] !== undefined) {
      problems.push(`${name}: view.client.tsx exists but the runtime is 'shared'`);
    }
    // A shared component may render a client module of its own (an enhancement), named `*.client.tsx`;
    // any other file that is a client module would make the component itself one.
    for (const [file, text] of Object.entries(files)) {
      if (file.endsWith('.client.tsx')) continue;
      if (/^\s*['"]use client['"]/.test(text)) problems.push(`${name}: ${file} is a client module`);
    }
  }
  for (const required of ['styles.css', 'fixtures.ts', `${name}.test.tsx`]) {
    if (files[required] === undefined) problems.push(`${name}: ${required} is missing`);
  }
  const css = files['styles.css'];
  if (css !== undefined && !css.includes('@layer buildr.components')) {
    problems.push(`${name}: styles.css must be inside @layer buildr.components`);
  }
  return problems;
}
