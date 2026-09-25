import { describe, expect, it } from 'vitest';
import { BRIEFS } from './briefs.ts';
import { scoreRun } from './scorer.ts';
import type { OutlineEntry, QualityIssue, RunRecord, ToolCall } from './types.ts';

const brief = BRIEFS[0] as (typeof BRIEFS)[number];

const call = (name: string, args: Record<string, unknown> = {}, isError = false): ToolCall => ({
  name,
  args,
  isError,
});

const text = (id: string, type: string, value: string, translations?: string[]): OutlineEntry => ({
  id,
  type,
  text: value,
  ...(translations === undefined ? {} : { translations }),
});

/** A good page: hero, features and contact from templates, everything translated. */
function goodOutline(): OutlineEntry {
  return {
    id: 'root',
    type: 'buildr/page',
    slots: {
      default: [
        {
          id: 'hero',
          type: 'buildr/section',
          template: 'buildr/hero',
          slots: {
            default: [
              text('h1', 'buildr/heading', 'Chleb z pieca', ['en']),
              text('b1', 'buildr/button', 'Zamow', ['en']),
            ],
          },
        },
        {
          id: 'features',
          type: 'buildr/section',
          template: 'buildr/feature-grid',
          slots: { default: [text('f1', 'buildr/heading', 'Swieze', ['en'])] },
        },
        {
          id: 'contact',
          type: 'buildr/section',
          template: 'buildr/contact',
          slots: { default: [text('c1', 'buildr/heading', 'Napisz', ['en'])] },
        },
      ],
    },
  };
}

const goodCalls = [
  call('create_document'),
  call('insert_nodes', { template: 'buildr/hero' }),
  call('update_node'),
  call('validate'),
  call('save'),
];

const run = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  brief,
  siteLocales: ['pl', 'en'],
  outline: goodOutline(),
  issues: [],
  calls: goodCalls,
  ...overrides,
});

const result = (record: RunRecord, rule: string) => {
  const found = scoreRun(record).rules.find((entry) => entry.rule === rule);
  if (found === undefined) throw new Error(`no rule ${rule}`);
  return found;
};

const issue = (patch: Partial<QualityIssue>): QualityIssue => ({
  source: 'validation',
  severity: 'error',
  code: 'x',
  message: 'x',
  ...patch,
});

describe('scoreRun', () => {
  it('gives a good run a full score', () => {
    const score = scoreRun(run());
    expect(score.rules.map((entry) => [entry.rule, entry.passed])).toEqual([
      ['saved', true],
      ['validates', true],
      ['a11y-clean', true],
      ['uses-templates', true],
      ['no-empty-slots', true],
      ['both-locales', true],
    ]);
    expect(score.score).toBe(1);
    expect(score.brief).toBe('bakery-landing');
  });

  it('fails a run that never saved, or edited after saving', () => {
    expect(result(run({ calls: [call('insert_nodes')] }), 'saved').passed).toBe(false);
    expect(result(run({ calls: [call('save'), call('update_node')] }), 'saved').passed).toBe(false);
    // A failed edit after the save changed nothing.
    expect(
      result(run({ calls: [call('save'), call('update_node', {}, true)] }), 'saved').passed,
    ).toBe(true);
  });

  it('fails validation errors but tolerates warnings and accessibility findings', () => {
    expect(result(run({ issues: [issue({ code: 'bad-prop' })] }), 'validates').passed).toBe(false);
    expect(
      result(
        run({ issues: [issue({ severity: 'warning' }), issue({ source: 'a11y' })] }),
        'validates',
      ).passed,
    ).toBe(true);
  });

  it('fails accessibility errors only', () => {
    const error = issue({ source: 'a11y', code: 'image-alt' });
    expect(result(run({ issues: [error] }), 'a11y-clean').passed).toBe(false);
    expect(result(run({ issues: [{ ...error, severity: 'warning' }] }), 'a11y-clean').passed).toBe(
      true,
    );
  });

  it('counts templates that are on the page or that were inserted', () => {
    const plain: OutlineEntry = {
      id: 'root',
      type: 'buildr/page',
      slots: {
        default: [
          {
            id: 's',
            type: 'buildr/section',
            slots: { default: [text('h', 'buildr/heading', 'Hej', ['en'])] },
          },
        ],
      },
    };
    expect(result(run({ outline: plain, calls: [call('save')] }), 'uses-templates').passed).toBe(
      false,
    );
    expect(
      result(
        run({
          outline: plain,
          calls: [
            call('insert_nodes', { template: 'buildr/hero' }),
            call('insert_nodes', { template: 'buildr/pricing' }),
            call('create_document', { template: 'buildr/contact' }),
            call('save'),
          ],
        }),
        'uses-templates',
      ).passed,
    ).toBe(true);
    // A template the agent tried and the server refused is not used.
    expect(
      result(
        run({ outline: plain, calls: [call('insert_nodes', { template: 'buildr/hero' }, true)] }),
        'uses-templates',
      ).passed,
    ).toBe(false);
  });

  it('finds empty containers, blank texts and placeholders', () => {
    const outline: OutlineEntry = {
      id: 'root',
      type: 'buildr/page',
      slots: {
        default: [
          { id: 'empty', type: 'buildr/section' },
          {
            id: 'full',
            type: 'buildr/section',
            slots: {
              default: [
                text('blank', 'buildr/text', '  ', ['en']),
                text('lorem', 'buildr/text', 'Lorem ipsum dolor', ['en']),
                text('ph', 'buildr/heading', 'Heading', ['en']),
              ],
            },
          },
        ],
      },
    };
    const found = result(run({ outline }), 'no-empty-slots');
    expect(found.passed).toBe(false);
    expect(found.detail).toContain('4 problem(s)');
  });

  it('does not call a truncated container empty, and fails an empty page', () => {
    const truncated: OutlineEntry = {
      id: 'root',
      type: 'buildr/page',
      slots: { default: [{ id: 's', type: 'buildr/section', hiddenDescendants: 5 }] },
    };
    expect(result(run({ outline: truncated }), 'no-empty-slots').passed).toBe(true);
    expect(
      result(run({ outline: { id: 'root', type: 'buildr/page' } }), 'no-empty-slots').passed,
    ).toBe(false);
  });

  it('needs every text in the other language, and skips bound texts', () => {
    const outline = goodOutline();
    const hero = outline.slots?.['default']?.[0] as OutlineEntry;
    const partial: OutlineEntry = {
      ...outline,
      slots: {
        default: [
          {
            ...hero,
            slots: {
              default: [
                text('h1', 'buildr/heading', 'Chleb z pieca'),
                { id: 'bound', type: 'buildr/heading', text: 'post.title', textKind: 'binding' },
              ],
            },
          },
        ],
      },
    };
    const missing = result(run({ outline: partial }), 'both-locales');
    expect(missing.passed).toBe(false);
    expect(missing.detail).toContain('h1 (en)');
    expect(
      result(
        run({ issues: [issue({ severity: 'info', code: 'missing-translation', locale: 'en' })] }),
        'both-locales',
      ).passed,
    ).toBe(false);
  });

  it('leaves the locale rule out of the score on a one-language site', () => {
    const score = scoreRun(run({ siteLocales: ['pl'], outline: { ...goodOutline() } }));
    const locale = score.rules.find((entry) => entry.rule === 'both-locales');
    expect(locale?.passed).toBeNull();
    expect(score.score).toBe(1);
  });

  it('scores the share of applicable rules passed', () => {
    const score = scoreRun(
      run({ issues: [issue({}), issue({ source: 'a11y', code: 'image-alt' })] }),
    );
    expect(score.score).toBeCloseTo(4 / 6);
  });
});
