import type { BuilderDocument, RegistryManifest } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../messages/index.tsx';
import type { IssueItem } from '../panels/issues/collect.ts';
import { localizeIssue } from './diagnostics.ts';
import { localizeManifest } from './localize-manifest.ts';

const source = {
  hash: 'x',
  templates: {},
  components: {
    'buildr/text': {
      type: 'buildr/text',
      label: 'Text',
      props: { text: { kind: 'text', label: 'Text', localizable: true, default: '', accepts: [] } },
      slots: {},
    },
  },
} as unknown as RegistryManifest;
const doc = { nodes: { n1: { id: 'n1', type: 'buildr/text' } } } as unknown as BuilderDocument;

const item = (extra: Partial<IssueItem> & Pick<IssueItem, 'code' | 'message'>): IssueItem => ({
  key: 'k',
  source: 'a11y',
  severity: 'warning',
  blocking: false,
  nodeId: 'n1',
  ...extra,
});
const input = (uiLocale: string) => ({
  t: createTranslator(uiLocale),
  uiLocale,
  doc,
  source,
  manifest: localizeManifest(source, uiLocale),
});

describe('localizeIssue', () => {
  it('translates an accessibility message and its help by rule code', () => {
    const out = localizeIssue(
      item({
        code: 'heading-order',
        message: 'The page layout already renders the H1; use a lower level.',
      }),
      input('pl'),
    );
    expect(out.message).toBe('Układ strony już wyświetla nagłówek H1; użyj niższego poziomu.');
    const jump = localizeIssue(
      item({
        code: 'heading-order',
        message: 'Heading level jumps from 2 to 4.',
        help: 'Do not skip levels; the size of a heading is a style, not its level.',
      }),
      input('pl'),
    );
    expect(jump.message).toBe('Poziom nagłówka przeskakuje z 2 na 4.');
    expect(jump.help).toContain('Nie pomijaj poziomów');
  });

  it('names the prop and the language in a missing translation', () => {
    const out = localizeIssue(
      item({
        code: 'missing-translation',
        message: '"Text" is not translated to en.',
        locale: 'en',
        help: 'The default-language text is shown until it is translated.',
      }),
      input('pl'),
    );
    expect(out.message).toBe('Pole „Tekst” nie jest przetłumaczone na język: angielski.');
    expect(out.help).toBe('Do czasu tłumaczenia widoczny jest tekst w języku domyślnym.');
  });

  it('translates document findings from their details', () => {
    const out = localizeIssue(
      item({
        source: 'validation',
        code: 'validation.slot-min',
        message: '"default" needs at least 2 item(s).',
        details: { slot: 'default', min: 2 },
      }),
      input('pl'),
    );
    expect(out.message).toBe('Miejsce „default”: minimalna liczba elementów to 2.');
  });

  it('keeps the check own message for an unknown code and for English', () => {
    const unknown = item({ code: 'x-unknown', message: 'Something odd.' });
    expect(localizeIssue(unknown, input('pl')).message).toBe('Something odd.');
    const known = item({ code: 'image-alt', message: 'This image has no alternative text.' });
    expect(localizeIssue(known, input('en')).message).toBe('This image has no alternative text.');
    expect(localizeIssue(known, input('pl')).code).toBe('image-alt');
  });
});
