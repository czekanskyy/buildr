import { s } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';

const media = (id: string) => s({ source: 'fixtures', collection: 'media', id }) as never;
/** An external source (ADR-028). `.invalid` never resolves, so nothing is fetched. */
const external = (url: string, mimeType?: string) =>
  s({ external: true, url, ...(mimeType !== undefined ? { mimeType } : {}) }) as never;

export const videoFixtures: readonly ComponentFixture[] = [
  {
    id: 'video-media',
    title: 'Video: from the media library, with a poster',
    tree: {
      type: 'buildr/video',
      props: { video: media('v1'), poster: media('m1'), title: s('A cat yawning') },
    },
  },
  {
    id: 'video-captions',
    title: 'Video: with captions, square',
    tree: {
      type: 'buildr/video',
      props: {
        video: media('v1'),
        captions: media('c1'),
        captionsLanguage: s('en'),
        title: s('A cat yawning'),
        aspectRatio: s('1:1'),
      },
    },
  },
  {
    id: 'video-autoplay',
    title: 'Video: muted autoplay loop (keeps its controls)',
    tree: {
      type: 'buildr/video',
      props: {
        video: media('v1'),
        title: s('A cat yawning'),
        autoplay: s(true),
        loop: s(true),
        aspectRatio: s('21:9'),
        fit: s('cover'),
      },
    },
  },
  {
    id: 'video-external',
    title: 'Video: an external HTTPS file',
    tree: {
      type: 'buildr/video',
      props: {
        video: external('https://media.example.invalid/clip.mp4', 'video/mp4'),
        title: s('A cat yawning'),
      },
    },
  },
  {
    id: 'video-empty',
    title: 'Video: nothing chosen yet',
    tree: { type: 'buildr/video', props: { title: s('A cat yawning') } },
  },
] as const;

/** The media the fixtures name (`MemoryDataSource` input): a clip and its captions. */
export const videoFixtureMedia = {
  v1: {
    id: 'v1',
    url: '/media/cat.mp4',
    width: 1280,
    height: 720,
    mimeType: 'video/mp4',
  },
  c1: {
    id: 'c1',
    url: '/media/cat.vtt',
    mimeType: 'text/vtt',
  },
} as const;
