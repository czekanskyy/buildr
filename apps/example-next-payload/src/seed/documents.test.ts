import { type BuilderDocument, runA11y, validateDocument } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { registry } from '../buildr.registry.ts';
import { buildSeedDocuments, type SeedMedia } from './documents.ts';

const team: SeedMedia = {
  id: '1',
  url: '/api/media/file/team.svg',
  alt: { pl: 'Zespół przy stole', en: 'The team around a table' },
  width: 1200,
  height: 800,
};
const seeds = buildSeedDocuments({ team });
const all = [...Object.entries(seeds.pages), ...Object.entries(seeds.templates)] as [
  string,
  BuilderDocument,
][];
const locales = {
  locales: ['pl', 'en'],
  default: 'pl',
  fallback: false,
  intl: { pl: 'pl', en: 'en' },
};

describe('seed documents', () => {
  it.each(all)('%s is valid', (_name, doc) => {
    const result = validateDocument(doc, { registry: registry.meta });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(all)('%s has no accessibility issues, translations included', (_name, doc) => {
    // Every seeded layout renders its own H1 (the plugin's `expectH1`).
    const issues = runA11y(doc, registry.meta, { locales, config: { expectH1: 'document' } });
    expect(issues).toEqual([]);
  });

  it('is deterministic', () => {
    expect(buildSeedDocuments({ team })).toEqual(seeds);
  });
});
