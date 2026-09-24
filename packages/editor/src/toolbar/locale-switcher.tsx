import { useT } from '../messages/index.tsx';
import { useLocaleState } from '../store/index.ts';
import { Select } from '../ui/index.ts';

export interface LocaleSwitcherProps {
  /** Tells the canvas which language to render (`CanvasHost.setLocale`). */
  readonly onChange?: ((locale: string) => void) | undefined;
}

/**
 * Chooses the language of the content being edited (docs/editor.md#content-language). Renders
 * nothing when there is only one language.
 */
export function LocaleSwitcher({ onChange }: LocaleSwitcherProps) {
  const t = useT();
  const config = useLocaleState((state) => state.config);
  const locale = useLocaleState((state) => state.locale);
  const setLocale = useLocaleState((state) => state.setLocale);
  if (config.locales.length < 2) return null;
  return (
    <Select
      label={t('locale.label')}
      value={locale}
      onValueChange={(next) => {
        setLocale(next);
        onChange?.(next);
      }}
      options={config.locales.map((code) => ({ value: code, label: config.intl[code] ?? code }))}
    />
  );
}
