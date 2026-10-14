import {
  type BuilderDocument,
  bind,
  createSeededIdGenerator,
  DEFAULT_DOCUMENT_LIMITS,
  expr,
  s,
} from '@next-buildr/core';
import { doc, type NodeTree } from '../../builders.ts';

export interface LargeDocumentOptions {
  /** Total node count of the document, the root included. Must be at least 1. */
  readonly nodes: number;
  /** Varies ids, copy, layout choices and style values. Defaults to `"large"`. */
  readonly seed?: string;
}

// A section frame is section, container, heading and grid; a minimal card is card, heading, text.
const MIN_CARDS = 2;
const NODES_PER_CARD = 3;
const SECTION_FRAME = 4;
const TOPICS = [
  'Analytics',
  'Billing',
  'Catalog',
  'Delivery',
  'Editor',
  'Forms',
  'Gallery',
  'Help',
];
const TONES = ['calm', 'bold', 'quiet', 'bright', 'plain'];
const COLUMNS = [2, 3, 4];
const GAPS = ['0.5rem', '1rem', '1.5rem', '2rem'];
const VARIANTS = ['outlined', 'elevated', 'flat'];
const WIDTHS = ['sm', 'md', 'lg', 'xl'];

// mulberry32 - the same small deterministic PRNG family the seeded ID generator uses.
function createRandom(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic, realistic document for performance work: repeating
 * `section > container > grid > card` blocks (cards hold a heading, text, and optionally a
 * button and an image) with localized copy, data bindings, formulas, and breakpoint styles.
 *
 * `nodes` is the exact number of entries in `doc.nodes` and **includes the root**, so
 * `createLargeDocument({ nodes: 5000 })` sits exactly on `DEFAULT_DOCUMENT_LIMITS.maxNodes`.
 * Sections fill the budget; any remainder too small for a section becomes text nodes directly
 * under the root. The result respects the default depth, slot-width and byte limits.
 * The same `seed` always yields the same document (ids included); no clock or `Math.random`.
 */
export function createLargeDocument(options: LargeDocumentOptions): BuilderDocument {
  const { nodes } = options;
  const seed = options.seed ?? 'large';
  if (!Number.isInteger(nodes) || nodes < 1 || nodes > DEFAULT_DOCUMENT_LIMITS.maxNodes) {
    throw new RangeError(
      `createLargeDocument: nodes must be an integer from 1 to ${DEFAULT_DOCUMENT_LIMITS.maxNodes}`,
    );
  }

  const random = createRandom(seed);
  const int = (max: number): number => Math.floor(random() * max);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;

  let remaining = nodes - 1;
  let counter = 0;
  const sections: NodeTree[] = [];

  const card = (full: boolean, index: number): NodeTree => {
    const topic = pick(TOPICS);
    counter += 1;
    const ordinal = counter;
    const slots: Record<string, NodeTree[]> = {
      body: [
        {
          type: 'buildr/heading',
          props: {
            text: s(`${topic} ${ordinal}`, { l10n: { pl: `${topic} (pl) ${ordinal}` } }),
            level: s(3),
          },
        },
        {
          type: 'buildr/text',
          props:
            index % 3 === 0
              ? {
                  text: expr(`${topic}: {{ item.price * ${1 + int(9)} }}`, {
                    mode: 'template',
                    l10n: { pl: `${topic} (pl): {{ item.price * ${1 + int(9)} }}` },
                  }),
                }
              : index % 3 === 1
                ? { text: bind(`items[${int(20)}].summary`, { fallback: 'No summary' }) }
                : { text: s(`A ${pick(TONES)} note on ${topic}.`) },
        },
      ],
    };
    if (full) {
      slots['actions'] = [
        {
          type: 'buildr/button',
          props: { label: s('Open', { l10n: { pl: 'Otworz' } }), href: s(`/${topic}/${ordinal}`) },
        },
      ];
      slots['media'] = [
        {
          type: 'buildr/image',
          props: { image: bind(`items[${int(20)}].image`), alt: s(`${topic} picture`) },
        },
      ];
    }
    return {
      type: 'buildr/card',
      props: { variant: s(pick(VARIANTS)) },
      styles: {
        base: { spacing: { padding: { top: pick(GAPS) } } },
        bp: { mobile: { spacing: { padding: { top: '0.5rem' } } } },
      } as never,
      slots,
    };
  };

  while (remaining >= SECTION_FRAME + MIN_CARDS * NODES_PER_CARD) {
    const budget = Math.min(remaining, 20 + int(40));
    let left = budget - SECTION_FRAME;
    const cards: NodeTree[] = [];
    while (left >= NODES_PER_CARD && cards.length < 12) {
      const full = left >= NODES_PER_CARD + 2 && random() < 0.5;
      cards.push(card(full, cards.length));
      left -= full ? NODES_PER_CARD + 2 : NODES_PER_CARD;
    }
    // Whatever the card loop could not spend stays in the budget for the next section.
    remaining -= budget - left;
    counter += 1;
    sections.push({
      type: 'buildr/section',
      anchor: `section-${counter}`,
      props: { container: s('lg') },
      children: [
        {
          type: 'buildr/container',
          props: { width: s(pick(WIDTHS)) },
          children: [
            {
              type: 'buildr/heading',
              props: {
                text: s(`${pick(TOPICS)} overview`, { l10n: { pl: 'Przeglad' } }),
                level: s(2),
              },
            },
            {
              type: 'buildr/grid',
              styles: {
                base: { layout: { columns: pick(COLUMNS), gap: pick(GAPS) } },
                bp: {
                  tablet: { layout: { columns: 2 } },
                  mobile: { layout: { columns: 1 } },
                },
              } as never,
              children: cards,
            },
          ],
        },
      ],
    });
  }

  // The remainder is smaller than the smallest section: plain text under the root.
  const fillers: NodeTree[] = [];
  for (let i = 0; i < remaining; i++) {
    fillers.push({ type: 'buildr/text', props: { text: s(`Footnote ${i + 1}`) } });
  }

  return doc(
    { children: [...sections, ...fillers] },
    { idGen: createSeededIdGenerator(`test-utils/large/${seed}`) },
  );
}
