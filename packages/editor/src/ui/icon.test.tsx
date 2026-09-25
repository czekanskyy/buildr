// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { icons } from 'lucide-react';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../messages/index.tsx';
import { ComponentIcon, componentIconNames, Icon, IconButton, type IconName } from './index.ts';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pascal = (kebab: string) =>
  kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});
const show = (node: ReactNode) =>
  act(async () => root.render(<MessagesProvider locale="en">{node}</MessagesProvider>));

describe('icon maps', () => {
  it('name only real lucide icons (checked against the lucide-react export list)', () => {
    const unknown = componentIconNames.filter((name) => !(pascal(name) in icons));
    expect(unknown).toEqual([]);
    expect(componentIconNames.length).toBeGreaterThanOrEqual(60);
  });

  it('draws every editor icon, under real lucide names', async () => {
    const names: IconName[] = [
      'arrow-down',
      'arrow-left',
      'arrow-up',
      'box',
      'chevron-down',
      'chevron-right',
      'eye',
      'layout-grid',
      'link',
      'list',
      'list-ordered',
      'lock',
      'monitor-smartphone',
      'redo-2',
      'search',
      'triangle-alert',
      'undo-2',
      'x',
    ];
    await show(names.map((name) => <Icon key={name} name={name} />));
    expect(names.filter((name) => !(pascal(name) in icons))).toEqual([]);
    expect(container.querySelectorAll('svg')).toHaveLength(names.length);
  });
});

describe('Icon and ComponentIcon', () => {
  it('is decorative by default and an image with a label', async () => {
    await show(
      <>
        <Icon name="lock" />
        <Icon name="eye" label="Visible" />
      </>,
    );
    const [decorative, named] = [...container.querySelectorAll('svg')];
    expect(decorative?.getAttribute('aria-hidden')).toBe('true');
    expect(named?.getAttribute('role')).toBe('img');
    expect(named?.getAttribute('aria-label')).toBe('Visible');
    expect(named?.hasAttribute('aria-hidden')).toBe(false);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back to the neutral box for an unknown, inherited or missing name', async () => {
    await show(
      <>
        <ComponentIcon meta={{ icon: 'layout-grid' }} />
        <ComponentIcon meta={{ icon: 'nope' }} />
        <ComponentIcon meta={{ icon: 'constructor' }} />
        <ComponentIcon meta={{}} />
        <ComponentIcon meta={undefined} />
      </>,
    );
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs.map((svg) => svg.getAttribute('data-icon'))).toEqual([
      'layout-grid',
      'box',
      'box',
      'box',
      'box',
    ]);
    expect(svgs.slice(1).every((svg) => svg.getAttribute('data-fallback') === 'true')).toBe(true);
    expect(container.textContent).toBe('');
  });

  it('keeps the accessible name of an icon button', async () => {
    await show(<IconButton label="Undo" icon="undo-2" />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Undo');
    expect(button?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('no glyph icons (PB-120)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return entry === 'fonts' ? [] : walk(path);
      return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
    });

  it('uses no arrow, triangle, emoji or multiplication-sign glyph in any component file', () => {
    const glyph = /[←-⇿■-◿☀-➿×\u{1F300}-\u{1FAFF}]/u;
    const offenders = walk(join(import.meta.dirname, '..')).filter((file) =>
      glyph.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
