import {
  type BuilderDocument,
  createMemoryDataSource,
  type DataContext,
  type DataSource,
  s,
} from '@buildr/core';
import { doc } from '../builders.ts';

export interface GalleryFixture {
  readonly id: string;
  readonly title: string;
  readonly document: BuilderDocument;
}

const b = (path: string) => ({ kind: 'binding', path }) as const;

/** Documents the playground's gallery shows and `renderFixtureToHtml` renders, by stable id. */
export const galleryFixtures: readonly GalleryFixture[] = [
  {
    id: 'hello',
    title: 'Hello',
    document: doc({
      children: [
        {
          type: 'buildr/section',
          children: [
            { type: 'buildr/heading', props: { text: s('Hello, Buildr'), level: s(1) } },
            { type: 'buildr/text', props: { text: s('A page rendered from a document.') } },
          ],
        },
      ],
    }),
  },
  {
    id: 'styled',
    title: 'Styled sections',
    document: doc({
      children: [
        {
          type: 'buildr/section',
          styles: { base: { layout: { gap: '1rem' } } } as never,
          children: [
            { type: 'buildr/heading', props: { text: s('Styled'), level: s(2) } },
            { type: 'buildr/text', props: { text: s('Gap comes from the node style.') } },
          ],
        },
      ],
    }),
  },
  {
    id: 'loop',
    title: 'Loop over a collection',
    document: doc({
      children: [
        {
          type: 'buildr/loop',
          props: { source: s({ type: 'query', spec: { source: 'posts', limit: 10 } }) },
          slots: {
            item: [{ type: 'buildr/heading', props: { text: b('item.title'), level: s(3) } }],
            empty: [{ type: 'buildr/text', props: { text: s('No posts yet.') } }],
          },
        },
      ],
    }),
  },
];

/** The data the gallery documents read: a `posts` collection. */
export function createGalleryDataSource(): DataSource {
  return createMemoryDataSource({
    collections: {
      posts: [{ title: 'First post' }, { title: 'Second post' }, { title: 'Third post' }],
    },
  });
}

export function createGalleryContext(): DataContext {
  return {
    scopes: {},
    locale: 'en',
    locales: { default: 'en', fallback: true, intl: { en: 'English', pl: 'Polski' } },
    timeZone: 'UTC',
    mode: 'preview',
  };
}
