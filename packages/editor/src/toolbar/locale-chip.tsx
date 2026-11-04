import { useState } from 'react';
import { useT } from '../messages/index.tsx';
import { useLocaleState } from '../store/index.ts';
import { Button, type ButtonProps, Icon, Popover, Tooltip } from '../ui/index.ts';

export interface LocaleChipProps {
  /** Tells the canvas which language to render (`CanvasHost.setLocale`). */
  readonly onChange?: ((locale: string) => void) | undefined;
}

function LocaleButton({
  label,
  tip,
  code,
  ...rest
}: { readonly label: string; readonly tip: string; readonly code: string } & ButtonProps) {
  return (
    <Tooltip content={tip}>
      <Button {...rest} className="bd-locale-chip" variant="ghost" aria-label={label}>
        <Icon name="globe" />
        <span className="bd-locale-code">{code}</span>
      </Button>
    </Tooltip>
  );
}

/**
 * The content language as a globe and the language code; it opens a menu of the languages
 * (docs/editor.md#content-language). Renders nothing when there is only one language.
 */
export function LocaleChip({ onChange }: LocaleChipProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const config = useLocaleState((state) => state.config);
  const locale = useLocaleState((state) => state.locale);
  const setLocale = useLocaleState((state) => state.setLocale);
  if (config.locales.length < 2) return null;
  const name = (code: string) => config.intl[code] ?? code;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      contentClassName="bd-menu-popover"
      label={t('locale.label')}
      trigger={
        <LocaleButton
          label={t('toolbar.contentLanguage').replace('{language}', name(locale))}
          tip={t('locale.label')}
          code={locale.toUpperCase()}
        />
      }
    >
      <div className="bd-menu-list">
        {config.locales.map((code) => (
          <button
            key={code}
            type="button"
            className="bd-menu-item"
            aria-pressed={code === locale}
            onClick={() => {
              setOpen(false);
              setLocale(code);
              onChange?.(code);
            }}
          >
            <span className="bd-menu-item-label">{name(code)}</span>
            <span className="bd-locale-code">{code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
