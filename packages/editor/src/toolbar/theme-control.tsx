import { useT } from '../messages/index.tsx';
import { IconButton } from '../ui/index.ts';
import { useTheme } from './theme.tsx';

/** The quick theme action complements the explicit choices in the more menu. */
export function ThemeControl() {
  const t = useT();
  const theme = useTheme();
  if (theme === undefined || theme.forced) return null;
  const next =
    theme.preference === 'system' ? 'light' : theme.preference === 'light' ? 'dark' : 'system';
  return (
    <IconButton
      label={`${t('toolbar.theme')}: ${t(`toolbar.theme.${theme.preference}`)}`}
      hint={t(`toolbar.theme.${next}`)}
      icon={theme.preference === 'dark' ? 'moon' : theme.preference === 'light' ? 'sun' : 'monitor'}
      variant="ghost"
      onClick={() => theme.setPreference(next)}
    />
  );
}
