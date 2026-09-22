import { checkInvariants } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { invalidDocumentFixtures, validDocumentFixtures } from './index.ts';

describe('validDocumentFixtures', () => {
  it.each(validDocumentFixtures.map((doc, i) => [i, doc] as const))(
    'fixture %i yields zero diagnostics',
    (_i, doc) => {
      expect(checkInvariants(doc)).toEqual([]);
    },
  );
});

describe('invalidDocumentFixtures', () => {
  it('has at least 20 fixtures', () => {
    expect(invalidDocumentFixtures.length).toBeGreaterThanOrEqual(20);
  });

  it.each(invalidDocumentFixtures.map((fixture) => [fixture.name, fixture] as const))(
    '%s yields only its expected code',
    (_name, fixture) => {
      const diagnostics = checkInvariants(fixture.doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      for (const diagnostic of diagnostics) {
        expect(diagnostic.code).toBe(fixture.expectedCode);
      }
    },
  );
});
