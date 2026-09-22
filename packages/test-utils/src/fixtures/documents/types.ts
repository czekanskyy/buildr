import type { BuilderDocument } from '@buildr/core';

/** One corrupted document plus the single `checkInvariants` diagnostic code it must produce. */
export interface InvalidDocumentFixture {
  readonly name: string;
  readonly expectedCode: string;
  readonly doc: BuilderDocument;
}
