import { defineTemplate, type TemplateDefinition, type TreeNode } from '@next-buildr/core';
import { grid, heading, icon, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

const FEATURES = [
  ['zap', 'Fast by default', 'Say what makes it quick, in a sentence or two.'],
  ['shield', 'Safe to rely on', 'Say why people can trust it, in a sentence or two.'],
  ['layout-grid', 'Easy to arrange', 'Say how it fits into what they already do.'],
  ['star', 'Made with care', 'Say what sets the details apart.'],
  ['globe', 'Ready for everyone', 'Say who can use it and where.'],
  ['heart', 'Built to last', 'Say what keeps it useful over time.'],
] as const;

const feature = ([name, title, body]: (typeof FEATURES)[number]): TreeNode =>
  stack(
    [icon(name), heading(title, 3), text(body)],
    { base: { layout: { gap: '$space.2' } } },
    { name: 'Feature' },
  );

/** A heading and a grid of features: three columns, two on tablets, one on phones. */
export const FeatureGrid: TemplateDefinition = defineTemplate({
  id: 'buildr/feature-grid',
  version: 1,
  label: 'Feature grid',
  category: 'marketing',
  thumbnail: thumbnail([
    [50, 8, 60, 7],
    ...[0, 1].flatMap((row) =>
      [0, 1, 2].flatMap((col): [number, number, number, number, 'media' | 'line'][] => [
        [12 + col * 50, 28 + row * 34, 10, 10, 'media'],
        [12 + col * 50, 44 + row * 34, 34, 4, 'line'],
        [12 + col * 50, 52 + row * 34, 28, 3, 'line'],
      ]),
    ),
  ]),
  lock: 'none',
  tree: section([
    stack(
      [
        heading('Everything you need', 2),
        text('A short introduction to the features below.'),
        grid(FEATURES.map(feature), 3, 2, '$space.8'),
      ],
      { base: { layout: { gap: '$space.8' } } },
    ),
  ]),
});
