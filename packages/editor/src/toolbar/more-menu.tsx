import { useState } from 'react';
import { useT } from '../messages/index.tsx';
import {
  type KeyInput,
  useOpenShortcuts,
  useOptionalShortcutRegistry,
  useShortcutHint,
} from '../shortcuts/index.ts';
import { Icon, IconButton, Kbd, Popover } from '../ui/index.ts';
import { type ThemePreference, useTheme } from './theme.tsx';

export interface MoreMenuProps {
  /** The version history in the CMS; listed here only when it no longer fits the row. */
  readonly historyUrl?: string | undefined;
  /** The page in the CMS; listed here only when it no longer fits the row. */
  readonly cmsUrl?: string | undefined;
  /** The sample data row (templates with samples only): the chosen entry's name and how to change it. */
  readonly sample?: { readonly entry: string | undefined; readonly onOpen: () => void } | undefined;
  /** The help page; the Help row is left out without it. */
  readonly helpUrl?: string | undefined;
  /** Opens the shortcuts dialog directly; without it the provider's own opener, else the key is replayed. */
  readonly onOpenShortcuts?: (() => void) | undefined;
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
 * The more options menu: the theme segment (hidden when the host fixes the theme), sample data, the
 * shortcuts dialog with its key, help, and the links the row had no room for. Renders nothing when it
 * would be empty. There is no block outlines toggle: the editor has no state for it yet.
 */
export function MoreMenu({ historyUrl, cmsUrl, sample, helpUrl, onOpenShortcuts }: MoreMenuProps) {
  const t = useT();
  const theme = useTheme();
  const registry = useOptionalShortcutRegistry();
  const fromProvider = useOpenShortcuts();
  const openShortcuts = onOpenShortcuts ?? fromProvider;
  const [open, setOpen] = useState(false);
  const helpCombo = registry?.keysFor('help.shortcuts')[0];
  const helpHint = useShortcutHint('help.shortcuts');
  const showTheme = theme !== undefined && !theme.forced;
  const hasLinks = cmsUrl !== undefined || historyUrl !== undefined;
  const hasShortcuts =
    openShortcuts !== undefined || (registry !== undefined && helpCombo !== undefined);
  if (!hasLinks && !hasShortcuts && !showTheme && sample === undefined && helpUrl === undefined) {
    return null;
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      contentClassName="bd-menu-popover"
      label={t('toolbar.moreOptions')}
      trigger={<IconButton label={t('toolbar.moreOptions')} icon="ellipsis" variant="ghost" />}
    >
      <div className="bd-menu-list">
        {cmsUrl !== undefined && (
          <a className="bd-menu-item" href={cmsUrl}>
            <Icon name="arrow-left" /> {t('toolbar.backToCms')}
          </a>
        )}
        {historyUrl !== undefined && (
          <a className="bd-menu-item" href={historyUrl}>
            <Icon name="history" /> {t('toolbar.versions')}
          </a>
        )}
        {hasLinks && (showTheme || sample !== undefined || hasShortcuts) && (
          <hr className="bd-menu-separator" />
        )}
        {showTheme && (
          <fieldset className="bd-menu-theme" aria-label={t('toolbar.themeLabel')}>
            <legend className="bd-menu-caption">{t('toolbar.themeLabel')}</legend>
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
        {showTheme && (sample !== undefined || hasShortcuts) && (
          <hr className="bd-menu-separator" />
        )}
        {sample !== undefined && (
          <button
            type="button"
            className="bd-menu-item"
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(false);
              sample.onOpen();
            }}
          >
            <Icon name="database" />
            <span className="bd-menu-item-label">{t('toolbar.sampleData')}</span>
            {sample.entry !== undefined && (
              <Kbd className="bd-menu-kbd" aria-hidden>
                {t('toolbar.sampleData.entry').replace('{name}', sample.entry)}
              </Kbd>
            )}
          </button>
        )}
        {sample !== undefined && hasShortcuts && <hr className="bd-menu-separator" />}
        {hasShortcuts && (
          <button
            type="button"
            className="bd-menu-item"
            aria-haspopup="dialog"
            aria-keyshortcuts={helpCombo}
            onClick={() => {
              setOpen(false);
              if (openShortcuts !== undefined) {
                openShortcuts();
                return;
              }
              // Fallback: replay the key. After the menu has left the page, as the shortcut
              // ignores keys while an overlay is open.
              if (registry === undefined || helpCombo === undefined) return;
              setTimeout(() => {
                registry.handle(inputOf(helpCombo, registry.platform), { typing: false });
              }, 0);
            }}
          >
            <Icon name="keyboard" />
            <span className="bd-menu-item-label">{t('toolbar.shortcuts')}</span>
            {helpHint !== undefined && (
              <Kbd className="bd-menu-kbd" aria-hidden>
                {helpHint}
              </Kbd>
            )}
          </button>
        )}
        {helpUrl !== undefined && (
          <a className="bd-menu-item" href={helpUrl} target="_blank" rel="noreferrer">
            <Icon name="circle-question-mark" />
            <span className="bd-menu-item-label">{t('toolbar.help')}</span>
          </a>
        )}
      </div>
    </Popover>
  );
}
