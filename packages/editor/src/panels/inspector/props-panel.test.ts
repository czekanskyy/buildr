import { p } from '@next-buildr/core';
import { expect, it } from 'vitest';
import { isExternalUrlProp, propGroup } from './props-panel.tsx';

it('collects background and overlay props in the background group', () => {
  const image = p.media({ label: 'Background image', accept: ['image'] });
  expect(propGroup('backgroundImage', image)).toBe('background');
  expect(propGroup('overlayTone', p.text({ label: 'x' }))).toBe('background');
  expect(propGroup('bleed', p.boolean({ label: 'x', default: false }))).toBe('');
  expect(propGroup('background', p.text({ label: 'x' }))).toBe('');
  expect(propGroup('width', p.text({ label: 'x', group: 'advanced' }))).toBe('advanced');
});

it('treats only the iframe url as an always-external text prop', () => {
  const text = p.text({ label: 'Address', default: '' });
  expect(isExternalUrlProp('buildr/iframe', 'url', text)).toBe(true);
  expect(isExternalUrlProp('buildr/iframe', 'title', text)).toBe(false);
  expect(isExternalUrlProp('buildr/link', 'url', text)).toBe(false);
});
