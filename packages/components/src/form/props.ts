import { p } from '@next-buildr/core';

export const formProps = {
  /** Shown, in a live region, after a successful submission (with JavaScript). Empty uses the built-in text. */
  successMessage: p.text({ label: 'Success message', default: '', localizable: true }),
  /** Shown when the submission failed. Empty uses the built-in text. */
  errorMessage: p.text({ label: 'Error message', default: '', localizable: true }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
