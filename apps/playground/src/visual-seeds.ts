import { type BuilderDocument, registryVersions, s } from '@next-buildr/core';
import { doc, type NodeTree } from '@next-buildr/test-utils';
import type { EditorSeed } from './editor-route.ts';
import { registry } from './registry.ts';

const heading = (text: string, level: number) => ({
  type: 'buildr/heading',
  props: { text: s(text), level: s(level) },
});
const text = (value: string) => ({ type: 'buildr/text', props: { text: s(value) } });
const button = (label: string, variant?: string) => ({
  type: 'buildr/button',
  props: { label: s(label), ...(variant === undefined ? {} : { variant: s(variant) }) },
});

const versions = registryVersions(registry.meta);

/** A band: the container a section migrates to (a bleeding flex column without a gap). */
const band = (name: string, children: NodeTree[], id?: string): NodeTree => ({
  ...(id === undefined ? {} : { id }),
  type: 'buildr/container',
  name,
  props: { as: s('section'), display: s('flex'), width: s('lg'), bleed: s(true) },
  styles: { base: { layout: { gap: '0' } } },
  children,
});
/** The container a stack migrates to: a flex column that sizes like content. */
const column = (name: string, children: NodeTree[]): NodeTree => ({
  type: 'buildr/container',
  name,
  props: { as: s('div'), display: s('flex'), width: s('none') },
  children,
});

/** A page with nothing on it (the editor's empty state). */
const empty = (): BuilderDocument => doc({ children: [] }, { versions });

/**
 * A small landing page: a Hero (pinned id, named `Hero`), three feature cards and a call
 * to action. Ids are seeded, so every run of the visual suite sees the same document.
 */
const landing = (): BuilderDocument =>
  doc(
    {
      children: [
        band(
          'Hero',
          [
            column('Copy', [
              heading('A headline that says what you do', 1),
              text('One or two sentences that tell a visitor why it matters and what to do next.'),
              column('Actions', [button('Get started'), button('Learn more', 'outline')]),
            ]),
            { type: 'buildr/image', name: 'Image', props: {} },
          ],
          'HeroNode01',
        ),
        band('Features', [
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
        ]),
        band('Call to action', [heading('Ready when you are', 2), button('Contact us')]),
      ],
    },
    { versions },
  );

export const seeds: Readonly<Record<EditorSeed, () => BuilderDocument>> = { empty, landing };
