import { defineComponent } from '@next-buildr/react';
import { mapProps } from './props.ts';
import { MapView } from './view.tsx';
// biome-ignore lint/suspicious/noShadowRestrictedNames: Public component name matches buildr/map.
export const Map = defineComponent({
  type: 'buildr/map',
  version: 1,
  label: 'Map',
  description: 'Google map.',
  keywords: ['map', 'mapa'],
  category: 'media',
  icon: 'map-pin',
  contentCategories: ['flow'],
  props: mapProps,
  styles: { groups: ['size', 'spacing', 'border', 'effects', 'visibility'] },
  a11y: { element: 'div' },
  runtime: 'shared',
  render: MapView,
});
