#!/usr/bin/env node
// Builds a package's published stylesheet: flattens the ordered `@import "./x.css"` lines of
// `src/styles.css` into a single `dist/styles.css` (every partial inlined, in order), and copies
// the font files it references to `dist/fonts/`. `url(../fonts/...)` in a partial (relative to
// `src/styles/`) is rewritten to `./fonts/...` (relative to `dist/styles.css`).
// The dev entry keeps the `@import` lines so bundlers resolve the partials directly.
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const srcDir = resolve(process.cwd(), 'src');
const distDir = resolve(process.cwd(), process.argv[2] ?? 'dist');
const entry = resolve(srcDir, 'styles.css');
const IMPORT = /^@import\s+(?:url\()?["']([^"']+)["']\)?\s*;\s*$/gm;

async function flatten(file) {
  const source = await readFile(file, 'utf8');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(IMPORT)) {
    parts.push(source.slice(last, match.index));
    parts.push(await flatten(resolve(dirname(file), match[1])));
    last = match.index + match[0].length;
  }
  parts.push(source.slice(last));
  return parts.join('');
}

if (existsSync(entry)) {
  const css = (await flatten(entry)).replaceAll('url("../fonts/', 'url("./fonts/');
  await mkdir(distDir, { recursive: true });
  await writeFile(resolve(distDir, 'styles.css'), css);
  if (existsSync(resolve(srcDir, 'fonts'))) {
    await cp(resolve(srcDir, 'fonts'), resolve(distDir, 'fonts'), { recursive: true });
  }
}
