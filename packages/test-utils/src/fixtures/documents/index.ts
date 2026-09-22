import { cycleFixtures } from './cycles.ts';
import { danglingChildFixtures } from './dangling-children.ts';
import { duplicateAnchorFixtures } from './duplicate-anchors.ts';
import { mismatchedKeyFixtures } from './mismatched-keys.ts';
import { multipleParentsFixtures } from './multiple-parents.ts';
import { orphanFixtures } from './orphans.ts';
import { rootFixtures } from './root.ts';
import type { InvalidDocumentFixture } from './types.ts';

export type { InvalidDocumentFixture } from './types.ts';
export { validDocumentFixtures } from './valid.ts';

/**
 * The full corpus of corrupted-but-shaped-correctly documents for `checkInvariants` coverage
 * (see docs/backlog/phase-01-core-document.md, PB-009): orphans, cycles, double parenting, a
 * mismatched map key, a duplicate anchor, plus dangling child references and root corruption.
 * Each fixture's `checkInvariants(fixture.doc)` diagnostics are every one `expectedCode`.
 */
export const invalidDocumentFixtures: readonly InvalidDocumentFixture[] = [
  ...orphanFixtures,
  ...cycleFixtures,
  ...multipleParentsFixtures,
  ...mismatchedKeyFixtures,
  ...duplicateAnchorFixtures,
  ...danglingChildFixtures,
  ...rootFixtures,
];
