import { type BuilderDocument, s } from '@buildr/core';
import { doc } from '@buildr/test-utils';
import type { EditorSeed } from './editor-route.ts';

const heading = (text: string, level: number) => ({
  type: 'buildr/heading',
  props: { text: s(text), level: s(level) },
});
const text = (value: string) => ({ type: 'buildr/text', props: { text: s(value) } });
const button = (label: string, variant?: string) => ({
  type: 'buildr/button',
  props: { label: s(label), ...(variant === undefined ? {} : { variant: s(variant) }) },
});

/** A page with nothing on it (the editor's empty state). */
const empty = (): BuilderDocument => doc({ children: [] });

/**
 * A small landing page: a Hero (pinned id, named `Hero`), three feature cards and a call
 * to action. Ids are seeded, so every run of the visual suite sees the same document.
 */
const landing = (): BuilderDocument =>
  doc({
    children: [
      {
        id: 'HeroNode01',
        type: 'buildr/section',
        name: 'Hero',
        children: [
          {
            type: 'buildr/stack',
            name: 'Copy',
            children: [
              heading('A headline that says what you do', 1),
              text('One or two sentences that tell a visitor why it matters and what to do next.'),
              {
                type: 'buildr/stack',
                name: 'Actions',
                children: [button('Get started'), button('Learn more', 'outline')],
              },
            ],
          },
          { type: 'buildr/image', name: 'Image', props: {} },
        ],
      },
      {
        type: 'buildr/section',
        name: 'Features',
        children: [
          heading('Everything in one place', 2),
          {
            type: 'buildr/grid',
            name: 'Feature grid',
            children: [
              {
                type: 'buildr/card',
                name: 'Fast',
                slots: { body: [heading('Fast', 3), text('Loads at once.')] },
              },
              {
                type: 'buildr/card',
                name: 'Simple',
                slots: { body: [heading('Simple', 3), text('Easy to edit.')] },
              },
              {
                type: 'buildr/card',
                name: 'Yours',
                slots: { body: [heading('Yours', 3), text('Own your data.')] },
              },
            ],
          },
        ],
      },
      {
        type: 'buildr/section',
        name: 'Call to action',
        children: [heading('Ready when you are', 2), button('Contact us')],
      },
    ],
  });

export const seeds: Readonly<Record<EditorSeed, () => BuilderDocument>> = { empty, landing };
