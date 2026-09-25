/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const stylesDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = join(stylesDir, '..');
const packageDir = join(srcDir, '..');
const bundleScript = join(packageDir, '../../tooling/scripts/bundle-css.mjs');
const PARTIALS = ['tokens', 'base', 'shell', 'primitives', 'panels'];

const read = (file: string) => readFileSync(join(stylesDir, file), 'utf8');
const tokensCss = read('tokens.css');

/** The body of the first rule whose selector list contains `selector`. */
function block(css: string, selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1] as string, (match[2] as string).trim());
  }
  return map;
}

const light = declarations(block(tokensCss, '.buildr-editor,\n.bd-portal'));
const dark = declarations(block(tokensCss, '.buildr-editor[data-theme="dark"]'));
const darkMedia = declarations(
  block(
    tokensCss,
    '.buildr-editor:not([data-theme="light"])',
    tokensCss.indexOf('@media (prefers-color-scheme'),
  ),
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const BOUNDARY = 3;

/** The contrast table of docs/design/identity.md section 8 (plus the danger fill added in PB-119). */
function pairs(): { kind: string; fg: string; bg: string; min: number }[] {
  const out: { kind: string; fg: string; bg: string; min: number }[] = [];
  const add = (kind: string, fg: string, bg: string, min: number) =>
    out.push({ kind, fg, bg, min });
  for (const fg of ['text', 'text-muted', 'text-subtle']) {
    for (const bg of ['surface', 'surface-2', 'bg', 'surface-hover', 'surface-selected']) {
      add('text', fg, bg, TEXT);
    }
  }
  add('text', 'text', 'accent-soft', TEXT);
  add('text', 'primary-text', 'primary', TEXT);
  add('text', 'primary-text', 'primary-hover', TEXT);
  for (const bg of ['surface', 'surface-2', 'accent-soft', 'surface-selected']) {
    add('text', 'accent', bg, TEXT);
  }
  add('text', 'accent-text', 'accent', TEXT);
  add('text', 'danger-text', 'danger', TEXT);
  for (const s of ['danger', 'warning', 'success', 'info']) {
    add('text', s, 'surface', TEXT);
    add('text', s, `${s}-soft`, TEXT);
  }
  for (const fg of ['toolbar-text', 'toolbar-muted']) {
    for (const bg of ['toolbar', 'toolbar-hover']) add('text', fg, bg, TEXT);
  }
  for (const bg of ['surface', 'surface-2', 'bg']) add('boundary', 'border-strong', bg, BOUNDARY);
  for (const bg of ['surface', 'bg']) add('boundary', 'focus', bg, BOUNDARY);
  add('boundary', 'toolbar-focus', 'toolbar', BOUNDARY);
  for (const fg of ['accent', 'primary']) {
    for (const bg of ['surface', 'bg']) add('boundary', fg, bg, BOUNDARY);
  }
  return out;
}

describe('design tokens: contrast (identity.md section 8)', () => {
  for (const [theme, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`meets 4.5:1 for text and 3:1 for boundaries in the ${theme} theme`, () => {
      const failures: string[] = [];
      for (const { kind, fg, bg, min } of pairs()) {
        const a = tokens.get(`--bd-${fg}`) ?? light.get(`--bd-${fg}`);
        const b = tokens.get(`--bd-${bg}`) ?? light.get(`--bd-${bg}`);
        if (!a?.startsWith('#') || !b?.startsWith('#')) {
          failures.push(`${fg} / ${bg}: not a hex token`);
          continue;
        }
        const r = ratio(a, b);
        if (r < min) failures.push(`${kind} ${fg} ${a} on ${bg} ${b}: ${r.toFixed(2)} < ${min}`);
      }
      expect(failures).toEqual([]);
    });
  }

  it('keeps the system-dark block identical to data-theme="dark"', () => {
    for (const [name, value] of dark) {
      if (name === '--bd-canvas-page') continue;
      expect(darkMedia.get(name), name).toBe(value);
    }
  });

  it('declares color-scheme for both themes', () => {
    expect(tokensCss).toMatch(/color-scheme:\s*light;/);
    expect(tokensCss.match(/color-scheme:\s*dark;/g)).toHaveLength(2);
  });

  it('overrides the durations under prefers-reduced-motion', () => {
    const reduced = tokensCss.slice(tokensCss.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toContain('--bd-duration-fast: 0ms');
    expect(reduced).toContain('--bd-duration-base: 0ms');
  });
});

describe('design tokens: usage', () => {
  const defined = new Set(light.keys());
  const partials = PARTIALS.map((name) => ({ name, css: read(`${name}.css`) }));

  it('defines every colour role in both themes', () => {
    const roles = pairs().flatMap((p) => [p.fg, p.bg]);
    for (const role of new Set(roles)) {
      expect(light.has(`--bd-${role}`), `light ${role}`).toBe(true);
      expect(dark.has(`--bd-${role}`), `dark ${role}`).toBe(true);
    }
    for (const role of ['border', 'toolbar-border', 'accent-hover', 'shadow', 'overlay']) {
      expect(dark.has(`--bd-${role}`), `dark ${role}`).toBe(true);
    }
  });

  it('only uses var(--bd-*) tokens that tokens.css defines', () => {
    const missing: string[] = [];
    for (const { name, css } of partials) {
      for (const match of css.matchAll(/var\(\s*(--bd-[\w-]+)/g)) {
        if (!defined.has(match[1] as string)) missing.push(`${name}.css: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('never gives a token a fallback value', () => {
    const fallbacks: string[] = [];
    for (const { name, css } of partials) {
      for (const match of css.matchAll(/var\(\s*--bd-[\w-]+\s*,/g)) {
        fallbacks.push(`${name}.css: ${match[0]}`);
      }
    }
    expect(fallbacks).toEqual([]);
  });

  it('keeps literal colours out of every partial except tokens.css', () => {
    for (const { name, css } of partials.filter((p) => p.name !== 'tokens')) {
      expect(css, name).not.toMatch(/#[0-9a-f]{3,8}\b(?![\w-])/i);
      expect(css, name).not.toMatch(/\b(rgba?|hsla?)\(/);
    }
  });

  it('lists every partial, in order, in the dev entry', () => {
    const entry = readFileSync(join(srcDir, 'styles.css'), 'utf8');
    const imports = [...entry.matchAll(/@import\s+"\.\/styles\/([\w-]+)\.css";/g)].map((m) => m[1]);
    expect(imports).toEqual(PARTIALS);
  });
});

describe('published stylesheet (bundle-css.mjs)', () => {
  const out = mkdtempSync(join(tmpdir(), 'bd-editor-css-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  execFileSync(process.execPath, [bundleScript, out], { cwd: packageDir });
  const published = readFileSync(join(out, 'styles.css'), 'utf8');

  it('inlines every partial, in order, with no @import left', () => {
    expect(published).not.toMatch(/@import/);
    let at = -1;
    for (const { name } of PARTIALS.map((name) => ({ name }))) {
      const source = read(`${name}.css`);
      const index = published.indexOf(
        source.trim().slice(0, 200).replaceAll('../fonts/', './fonts/'),
      );
      expect(index, `${name}.css is inlined`).toBeGreaterThan(at);
      at = index;
    }
  });

  it('ships the Inter subsets and the licence next to the stylesheet', () => {
    const files = readdirSync(join(out, 'fonts'));
    for (const subset of ['latin', 'latin-ext']) {
      for (const weight of [400, 500, 600]) {
        expect(files).toContain(`inter-${subset}-${weight}-normal.woff2`);
      }
    }
    expect(files).toContain('LICENSE-inter.txt');
    expect(readFileSync(join(out, 'fonts/LICENSE-inter.txt'), 'utf8')).toContain(
      'SIL Open Font License',
    );
  });

  it('references only local font files that exist, and no external URL', () => {
    const urls = [...published.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(
      (m) => m[1] as string,
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^\.\/fonts\/inter-[\w-]+\.woff2$/);
      expect(existsSync(join(out, url))).toBe(true);
    }
    expect(published).not.toMatch(/https?:\/\//);
  });
});
