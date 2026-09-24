import { useT } from '../../../messages/index.tsx';
import { Button } from '../../../ui/index.ts';

/**
 * Says that what is edited depends on the language (docs/i18n.md#model-shared-structure-localized-content):
 * texts belong to the current one, structure and style to all of them. Nothing in the default language.
 */
export function TranslationBanner(props: {
  readonly locale: string | undefined;
  readonly defaultLocale: string | undefined;
}) {
  const t = useT();
  const { locale, defaultLocale } = props;
  if (locale === undefined || locale === defaultLocale) return null;
  return (
    <p className="bd-translation-banner" role="note" data-locale={locale}>
      {t('translation.banner')}
    </p>
  );
}

/**
 * Under a translatable field in another language: while the field is untranslated it says the
 * default-language text is shown (the control is greyed) and offers to start a translation from
 * it; once translated the field's own button removes the translation again.
 */
export function TranslationHint(props: {
  readonly translated: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onTranslate: () => void;
}) {
  const t = useT();
  if (props.translated) return null;
  return (
    <div className="bd-translation-hint">
      <p className="bd-field-hint">{t('translation.showingDefault')}</p>
      <Button
        variant="ghost"
        disabled={props.disabled}
        aria-label={`${t('translation.translate')}: ${props.label}`}
        onClick={props.onTranslate}
      >
        {t('translation.translate')}
      </Button>
    </div>
  );
}
