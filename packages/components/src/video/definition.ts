import { defineComponent } from '@next-buildr/react';
import { videoProps } from './props.ts';
import { VideoView } from './view.tsx';

export { VIDEO_ASPECT_RATIOS, VIDEO_FITS, VIDEO_PRELOADS } from './props.ts';

/**
 * A video from the media library or, after the editor's confirmation, an external HTTPS URL
 * (ADR-028), with a poster, controls, loop, muted autoplay and optional captions. It needs an
 * accessible name. Shown in Polish as "Wideo".
 */
export const Video = defineComponent({
  type: 'buildr/video',
  version: 1,
  label: 'Video',
  description: 'A video with an accessible name, optional poster and captions.',
  keywords: ['movie', 'film', 'wideo', 'clip', 'media', 'mp4', 'webm'],
  category: 'media',
  icon: 'video',
  contentCategories: ['flow', 'phrasing', 'media'],
  props: videoProps,
  styles: { groups: ['size', 'spacing', 'border', 'effects', 'motion', 'visibility'] },
  a11y: { element: 'video', requiresName: true },
  editor: { placeholder: 'Choose a video' },
  runtime: 'shared',
  render: VideoView,
});
