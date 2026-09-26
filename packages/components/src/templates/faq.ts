import { defineTemplate, s, type TemplateDefinition, type TreeNode } from '@next-buildr/core';
import { heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

const QUESTIONS = [
  ['What is this?', 'A short, direct answer.'],
  ['How much does it cost?', 'A short, direct answer.'],
  ['Can I change my mind?', 'A short, direct answer.'],
  ['Who do I ask for help?', 'A short, direct answer.'],
] as const;

const item = ([question, answer]: (typeof QUESTIONS)[number], index: number): TreeNode => ({
  type: 'buildr/accordion-item',
  props: { summary: s(question), defaultOpen: s(index === 0) } as never,
  children: [text(answer)],
});

/** Questions and answers, each in a native disclosure; the first one is open. */
export const Faq: TemplateDefinition = defineTemplate({
  id: 'buildr/faq',
  version: 1,
  label: 'FAQ',
  category: 'marketing',
  thumbnail: thumbnail([
    [50, 8, 60, 7],
    ...[0, 1, 2, 3].map((row): [number, number, number, number] => [24, 26 + row * 16, 112, 11]),
    [30, 30, 50, 3],
  ]),
  lock: 'none',
  tree: section(
    [
      stack(
        [
          heading('Frequently asked questions', 2),
          { type: 'buildr/accordion', children: QUESTIONS.map(item) },
        ],
        { base: { layout: { gap: '$space.6' } } },
      ),
    ],
    { container: 'md' },
  ),
});
