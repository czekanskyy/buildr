import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { hasIcon, ICON_NAMES, ICON_NODES, Icon } from './index.ts';

const html = (element: unknown) => renderToStaticMarkup(element as never);

describe('icons', () => {
  it('ships roughly 80 icons, sorted and unique', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(80);
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
  });

  it('draws every icon only with allowlisted shapes carrying only numeric or path attributes', () => {
    const tags = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
    for (const [name, shapes] of Object.entries(ICON_NODES)) {
      expect(shapes.length, name).toBeGreaterThan(0);
      for (const [tag, attributes] of shapes) {
        expect(tags.has(tag), `${name}: ${tag}`).toBe(true);
        for (const [key, value] of Object.entries(attributes)) {
          expect(key, name).toMatch(/^[a-zA-Z0-9-]+$/);
          expect(value, `${name}.${key}`).toMatch(/^[-0-9a-zA-Z .,]*$/);
        }
      }
    }
  });

  it('is decorative by default', () => {
    expect(html(<Icon name="check" />)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
    );
  });

  it('is named for assistive technology when it has a label', () => {
    const out = html(<Icon name="search" label="Search" size={16} />);
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Search"');
    expect(out).not.toContain('aria-hidden');
    expect(out).toContain('width="16"');
  });

  it.each(['nope', '', '__proto__', 'constructor', 'toString'])(
    'renders nothing for %j',
    (name) => {
      expect(html(<Icon name={name} />)).toBe('');
      expect(hasIcon(name)).toBe(false);
    },
  );

  it('carries the licence notice of the icon set', () => {
    const notice = readFileSync(new URL('../../LICENSE-lucide.txt', import.meta.url), 'utf8');
    expect(notice).toContain('ISC License');
    expect(notice).toContain('MIT License');
  });
});
