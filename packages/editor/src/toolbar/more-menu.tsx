import { useState } from 'react';
import { useT } from '../messages/index.tsx';
import { type KeyInput, useOptionalShortcutRegistry } from '../shortcuts/index.ts';
import { Icon, IconButton, Popover } from '../ui/index.ts';
import { type ThemePreference, useTheme } from './theme.tsx';

export interface MoreMenuProps {
  /** The version history in the CMS; listed here only when it no longer fits the row. */
  readonly historyUrl?: string | undefined;
  /** The page in the CMS; listed here only when it no longer fits the row. */
  readonly cmsUrl?: string | undefined;
}

const THEMES: readonly { value: ThemePreference; icon: 'sun' | 'moon' | 'monitor' }[] = [
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
  { value: 'system', icon: 'monitor' },
];

/** A canonical combination (`shift+?`) as the key press the registry handles. */
function inputOf(combo: string, platform: 'mac' | 'other'): KeyInput {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const has = (name: string) => parts.includes(name);
  const primary = has('mod');
  return {
    key,
    mods: {
      shift: has('shift'),
      alt: has('alt'),
      ctrl: has('ctrl') || (primary && platform === 'other'),
      meta: has('meta') || (primary && platform === 'mac'),
    },
  };
}

/**
 * The `more` menu: the theme switch (hidden when the host fixes the theme), the shortcuts help, and
 * the links the row had no room for. Renders nothing when it would be empty.
 */
export function MoreMenu({ historyUrl, cmsUrl }: MoreMenuProps) {
  const t = useT();
  const theme = useTheme();
  const registry = useOptionalShortcutRegistry();
  const [open, setOpen] = useState(false);
  const helpCombo = registry?.keysFor('help.shortcuts')[0];
  const showTheme = theme !== undefined && !theme.forced;
  if (historyUrl === undefined && cmsUrl === undefined && helpCombo === undefined && !showTheme) {
    return null;
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      contentClassName="bd-menu-popover"
      label={t('toolbar.more')}
      trigger={<IconButton label={t('toolbar.more')} icon="ellipsis" variant="ghost" />}
    >
      <div className="bd-menu-list">
        {cmsUrl !== undefined && (
          <a className="bd-menu-item" href={cmsUrl}>
            <Icon name="arrow-left" /> {t('toolbar.back')}
          </a>
        )}
        {historyUrl !== undefined && (
          <a className="bd-menu-item" href={historyUrl}>
            <Icon name="history" /> {t('toolbar.versions')}
          </a>
        )}
        {registry !== undefined && helpCombo !== undefined && (
          <button
            type="button"
            className="bd-menu-item"
            onClick={() => {
              setOpen(false);
              // The help dialog belongs to the shortcut provider, which opens it on its own key.
              registry.handle(inputOf(helpCombo, registry.platform), { typing: false });
            }}
          >
            <Icon name="keyboard" /> {t('shortcut.title')}
          </button>
        )}
        {showTheme && (
          <fieldset className="bd-menu-group" aria-label={t('toolbar.theme')}>
            <legend className="bd-menu-label">{t('toolbar.theme')}</legend>
            <div className="bd-segmented">
              {THEMES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="bd-button bd-segment"
                  data-variant="ghost"
                  aria-pressed={theme.preference === item.value}
                  onClick={() => theme.setPreference(item.value)}
                >
                  <Icon name={item.icon} /> {t(`toolbar.theme.${item.value}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Popover>
  );
}
