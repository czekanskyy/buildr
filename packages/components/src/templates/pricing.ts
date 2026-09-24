import { defineTemplate, s, type TemplateDefinition, type TreeNode } from '@buildr/core';
import { badge, button, grid, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

interface Plan {
  readonly name: string;
  readonly price: string;
  readonly note: string;
  readonly features: readonly string[];
  readonly featured?: boolean;
}

const PLANS: readonly Plan[] = [
  {
    name: 'Starter',
    price: '$0',
    note: 'per month',
    features: ['One feature', 'Another feature', 'A third feature'],
  },
  {
    name: 'Team',
    price: '$29',
    note: 'per month',
    features: ['Everything in Starter', 'A team feature', 'Priority support'],
    featured: true,
  },
  {
    name: 'Company',
    price: '$99',
    note: 'per month',
    features: ['Everything in Team', 'A company feature', 'A dedicated contact'],
  },
];

const features = (items: readonly string[]): TreeNode => ({
  type: 'buildr/list',
  props: { ariaLabel: s('Included') } as never,
  children: items.map((item) => ({ type: 'buildr/list-item', props: { text: s(item) } as never })),
});

const plan = (p: Plan): TreeNode => ({
  type: 'buildr/card',
  props: { variant: s(p.featured ? 'elevated' : 'outlined') } as never,
  name: p.name,
  slots: {
    body: [
      ...(p.featured ? [badge('Most popular')] : []),
      heading(p.name, 3),
      stack(
        [
          text(p.price, {
            base: { typography: { fontSize: '$fontSize.4xl', fontWeight: '$fontWeight.bold' } },
          }),
          text(p.note, { base: { typography: { color: '$color.text-muted' } } }),
        ],
        { base: { layout: { gap: '$space.1' } } },
        { name: 'Price' },
      ),
      features(p.features),
    ],
    actions: [button(`Choose ${p.name}`, { variant: p.featured ? 'primary' : 'outline' })],
  },
});

type Tone = 'media' | 'line' | 'action';

/** Three plans side by side (stacked on a phone), one of them highlighted. */
export const Pricing: TemplateDefinition = defineTemplate({
  id: 'buildr/pricing',
  version: 1,
  label: 'Pricing',
  category: 'marketing',
  thumbnail: thumbnail([
    [50, 8, 60, 7],
    ...[0, 1, 2].flatMap((col): [number, number, number, number, Tone][] => [
      [10 + col * 48, 26, 42, 62, 'line'],
      [16 + col * 48, 34, 30, 6, 'media'],
      [16 + col * 48, 46, 20, 8, 'media'],
      [16 + col * 48, 62, 30, 3, 'media'],
      [16 + col * 48, 76, 30, 7, 'action'],
    ]),
  ]),
  lock: 'none',
  tree: section([
    stack(
      [
        heading('Simple pricing', 2),
        text('Pick the plan that fits. Change it any time.'),
        grid(PLANS.map(plan), 3, 1, '$space.6'),
      ],
      { base: { layout: { gap: '$space.8' } } },
    ),
  ]),
});
