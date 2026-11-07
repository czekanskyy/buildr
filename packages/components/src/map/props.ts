import { p } from '@next-buildr/core';
import { IFRAME_ASPECT_RATIOS } from '../iframe/props.ts';
export const MAP_SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
export const MAP_REFERRER_POLICY = 'strict-origin';
export const MAP_EMBED_ORIGIN = 'https://www.google.com';
export const MAP_API_KEY_REGEX = /^[A-Za-z0-9_-]{20,128}$/;
export const MAP_LOCALE_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
export const mapProps = {
  query: p.text({ label: 'Query', default: '', bindable: true }),
  zoom: p.number({ label: 'Zoom', min: 0, max: 21, default: 15 }),
  mapType: p.select({ label: 'Map type', options: ['roadmap', 'satellite'], default: 'roadmap' }),
  title: p.text({ label: 'Accessible name', default: '', localizable: true, bindable: true }),
  aspectRatio: p.select({ label: 'Aspect ratio', options: IFRAME_ASPECT_RATIOS, default: '16:9' }),
} as const;
