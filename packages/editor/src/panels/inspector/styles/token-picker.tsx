import type { StylePropertyDef, Theme } from '@buildr/core';
import { useState } from 'react';
import { useT } from '../../../messages/index.tsx';
import { Button, ColorSwatch, Icon, Popover } from '../../../ui/index.ts';
import { type TokenEntry, tokenEntries } from './model.ts';

/**
 * The theme's tokens for a property, each with what it stands for: a swatch for a colour, the
 * value for a length or a font. Choosing one writes its `$scale.name` reference, exactly as typing
 * it would.
 */
export function TokenPicker(props: {
  readonly def: StylePropertyDef;
  readonly theme: Theme;
  readonly label: string;
  readonly current: string | undefined;
  readonly disabled: boolean;
  readonly onPick: (ref: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const entries = tokenEntries(props.def, props.theme);
  if (entries.length === 0) return null;
  const isColor = props.def.grammar.kind === 'color';
  const pick = (entry: TokenEntry) => {
    props.onPick(entry.ref);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="ghost"
          className="bd-icon-button bd-token-trigger"
          disabled={props.disabled}
          aria-label={`${t('style.tokens')}: ${props.label}`}
        >
          <Icon name="chevron-down" />
        </Button>
      }
    >
      <ul className="bd-token-list" aria-label={`${t('style.tokens')}: ${props.label}`}>
        {entries.map((entry) => (
          <li key={entry.ref}>
            <button
              type="button"
              className="bd-token"
              aria-pressed={props.current === entry.ref}
              onClick={() => pick(entry)}
            >
              {isColor ? <ColorSwatch color={entry.value} /> : null}
              <span className="bd-token-name">{entry.name}</span>
              {isColor ? null : <span className="bd-token-value">{entry.value}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
