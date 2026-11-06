import { defineComponent } from '@next-buildr/react';
import { iframeProps } from './props.ts';
import { IframeView } from './view.tsx';

export {
  IFRAME_ASPECT_RATIOS,
  IFRAME_REFERRER_POLICY,
  IFRAME_SANDBOX,
} from './props.ts';

/**
 * An embedded external page (ADR-028): HTTPS only, a required accessible title, a restrictive
 * `sandbox`, no referrer, lazy loading and no `allow` features. A host can restrict the domains
 * with `capabilities.iframeHosts`. The editor asks for confirmation before it stores a URL.
 */
export const Iframe = defineComponent({
  type: 'buildr/iframe',
  version: 1,
  label: 'Iframe',
  description: 'An embedded external page, such as a map or a form, with an accessible title.',
  keywords: ['embed', 'map', 'widget', 'external', 'frame', 'osadz'],
  category: 'media',
  icon: 'globe',
  contentCategories: ['flow', 'phrasing', 'media', 'interactive'],
  props: iframeProps,
  styles: { groups: ['size', 'spacing', 'border', 'effects', 'motion', 'visibility'] },
  a11y: { element: 'iframe', requiresName: true },
  editor: { placeholder: 'Enter an address' },
  runtime: 'shared',
  render: IframeView,
});
