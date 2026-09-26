import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const heading = (text: string) => ({
  type: 'buildr/heading',
  props: { text: s(text), level: s(3) },
});
const text = (value: string) => ({ type: 'buildr/text', props: { text: s(value) } });
const button = (label: string) => ({ type: 'buildr/button', props: { label: s(label) } });

export const cardFixtures: readonly ComponentFixture[] = [
  {
    id: 'card-basic',
    title: 'Card: a heading, text and an action',
    tree: {
      type: 'buildr/card',
      slots: {
        body: [heading('A card'), text('Some text about the thing.')],
        actions: [button('Learn more')],
      },
    },
  },
  {
    id: 'card-linked',
    title: 'Card: the whole card is a link',
    tree: {
      type: 'buildr/card',
      props: { href: s('/posts/a-post'), linkLabel: s('Read: A post'), variant: s('elevated') },
      slots: { body: [heading('A post'), text('An excerpt of the post.')] },
    },
  },
  {
    id: 'card-linked-with-action',
    title: 'Card: linked, with a button that stays clickable',
    tree: {
      type: 'buildr/card',
      props: { href: s('/posts/a-post'), linkLabel: s('Read: A post') },
      slots: {
        body: [heading('A post'), text('An excerpt.')],
        actions: [button('Share')],
      },
    },
  },
  {
    id: 'card-flat-div',
    title: 'Card: flat, a div, with mobile padding',
    tree: {
      type: 'buildr/card',
      props: { variant: s('flat'), as: s('div') },
      styles: {
        base: { spacing: { padding: { top: '1rem' } } },
        bp: { mobile: { spacing: { padding: { top: '0.5rem' } } } },
      } as never,
      slots: { body: [text('Just text.')] },
    },
  },
] as const;
