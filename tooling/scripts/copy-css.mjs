#!/usr/bin/env node
// Copies every `*.css` file from a package's `src/` into its `dist/`, preserving relative
// paths. `tsc -b` only emits `.js`/`.d.ts`; CSS needs this separate step (see ADR-021).
import { existsSync } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const srcDir = resolve(process.cwd(), 'src');
const distDir = resolve(process.cwd(), 'dist');

if (!existsSync(srcDir)) {
  process.exit(0);
}

await cp(srcDir, distDir, {
  recursive: true,
  filter: async (source) => {
    const stats = await stat(source);
    return stats.isDirectory() || source.endsWith('.css');
  },
});
