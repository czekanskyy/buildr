// A minimal component set for the playground and for render tests. The real components live in
// @buildr/components; these exist so the renderer can be exercised without depending on it.
import { p } from '@buildr/core';
import { createRegistry, defineComponent, type Platform } from '@buildr/react';
import { createElement } from 'react';

const base = {
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
} as const;

const Page = defineComponent({
  ...base,
  type: 'buildr/page',
  label: 'Page',
  runtime: 'shared',
  props: {},
  slots: { default: {} },
  capabilities: { root: true },
  render: ({ root, children }) => createElement('div', root, children),
});

const Section = defineComponent({
  ...base,
  type: 'buildr/section',
  label: 'Section',
  runtime: 'shared',
  props: {},
  slots: { default: {}, aside: {} },
  render: ({ root, slots }) =>
    createElement('section', root, slots['default'], createElement('aside', null, slots['aside'])),
});

const Heading = defineComponent({
  ...base,
  type: 'buildr/heading',
  label: 'Heading',
  runtime: 'shared',
  props: {
    text: p.text({ default: 'Heading', bindable: true }),
    level: p.number({ min: 1, max: 6, default: 2 }),
  },
  render: ({ props, root }) => createElement(`h${props.level}`, root, props.text),
});

const Text = defineComponent({
  ...base,
  type: 'buildr/text',
  label: 'Text',
  runtime: 'shared',
  props: { text: p.text({ default: '', bindable: true }) },
  render: ({ props, root }) => createElement('p', root, props.text),
});

const Loop = defineComponent({
  ...base,
  type: 'buildr/loop',
  label: 'Loop',
  runtime: 'shared',
  props: { source: p.listSource(), as: p.text({ default: '' }) },
  slots: { item: {}, empty: {}, after: {} },
  render: ({ root, slots }) =>
    createElement(
      'div',
      root,
      slots['item'],
      slots['empty'],
      createElement('footer', null, slots['after']),
    ),
});

/** Page, Section, Heading, Text and Loop: enough for every document in `galleryFixtures`. */
export const demoRegistry = createRegistry({
  components: [Page, Section, Heading, Text, Loop],
});

/** Plain anchors and images, no framework: what a Vite app or a test uses instead of `next/link`. */
export const demoPlatform: Platform = {
  Link: ({ href, children, ...rest }) => createElement('a', { href, ...rest }, children),
  Image: ({ src, alt, ...rest }) => createElement('img', { src, alt, ...rest }),
  formAction: (ref, nodeId) => `/forms/${ref}/${nodeId}`,
};
