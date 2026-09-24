import type { A11yRule } from '../types.ts';
import {
  buttonName,
  emptyHeading,
  headingOrder,
  imageAlt,
  linkHref,
  linkName,
  newTabLink,
} from './content.ts';
import { formLabel, formSubmit } from './forms.ts';
import {
  accordionStructure,
  duplicateAnchor,
  landmarkUnique,
  listStructure,
  nestedInteractive,
} from './structure.ts';
import { missingTranslation } from './translations.ts';

/** The rules that ship with the builder (docs/accessibility.md), in the order they report. */
export const mvpA11yRules: readonly A11yRule[] = [
  imageAlt,
  headingOrder,
  emptyHeading,
  buttonName,
  linkName,
  linkHref,
  formLabel,
  formSubmit,
  nestedInteractive,
  duplicateAnchor,
  listStructure,
  landmarkUnique,
  accordionStructure,
  newTabLink,
  missingTranslation,
];
