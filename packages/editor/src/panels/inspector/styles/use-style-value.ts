import type { EffectiveStyles, StylePropertyDef, Theme } from '@next-buildr/core';
import { useState } from 'react';
import { checkStyleInput } from './model.ts';

export interface StyleValueOptions {
  readonly def: StylePropertyDef;
  readonly path: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly onSet: (value: string | number) => void;
  readonly onUnset: () => void;
}

/**
 * The state of one style value being edited: what is typed (a draft until the field is left), the
 * stored value at the layer being edited, and the message when the text is outside the grammar.
 * Text is only handed to `onSet` after `checkStyleInput` accepted it, so nothing the grammar
 * refuses can be dispatched.
 */
export function useStyleValue({
  def,
  path,
  effective,
  layer,
  theme,
  onSet,
  onUnset,
}: StyleValueOptions) {
  const current = Object.hasOwn(effective, path) ? effective[path] : undefined;
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const stored = current !== undefined ? String(current.value) : '';
  const shown = draft ?? stored;

  const change = (text: string) => {
    setDraft(text);
    if (text.trim() === '') {
      setError('');
      if (current?.source === layer) onUnset();
      return;
    }
    const checked = checkStyleInput(def, text, theme);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError('');
    onSet(checked.value);
  };
  const pick = (ref: string) => {
    setDraft(undefined);
    setError('');
    onSet(ref);
  };
  const blur = () => {
    setDraft(undefined);
    setError('');
  };

  return {
    current,
    stored,
    shown,
    error,
    change,
    pick,
    blur,
    /** The value is inherited from a wider breakpoint rather than set at this layer. */
    inherited: current !== undefined && current.source !== layer,
  };
}
