import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

// `eval(`, `new Function`, `Function(` and `import(` of a computed specifier all run or load code
// built at runtime; `\b` keeps `evaluate(` and `retrieval(` from matching.
const FORBIDDEN: readonly [string, RegExp][] = [
  ['eval()', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['Function()', /(?<![.\w])Function\s*\(/],
  ['setTimeout(string)', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/],
];

describe('no dynamic code execution in @buildr/core', () => {
  const files = sourceFiles(SRC);

  it('scans the library sources', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('evaluate.ts'))).toBe(true);
  });

  it.each(FORBIDDEN)('contains no %s', (_name, pattern) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
