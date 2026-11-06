import { useState } from 'react';
import type { BreakpointConfig } from '../app/config.ts';
import { useT } from '../messages/index.tsx';
import { usePersistence, usePersistenceState } from '../persistence/index.ts';
import {
  type KeyInput,
  useOpenShortcuts,
  useOptionalShortcutRegistry,
  useShortcutHint,
} from '../shortcuts/index.ts';
import { useLocaleState } from '../store/index.ts';
import { useViewState } from '../store/react.tsx';
import { Icon, IconButton, Kbd, Popover } from '../ui/index.ts';
import { BREAKPOINT_ICONS, BREAKPOINT_LABELS } from './breakpoint-control.tsx';
import { safeHistory } from './safe-history.ts';
import { type ThemePreference, useTheme } from './theme.tsx';

/** What a phone-wide row moves into the menu: the screen size, Preview, the content language. */
export interface CompactMenu {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  readonly onPreview?: (() => void) | undefined;
  readonly onLocaleChange?: ((locale: string) => void) | undefined;
}

export interface MoreMenuProps {
  /** Set in a phone-wide row: the actions the row has no room for. */
  readonly compact?: CompactMenu | undefined;
  /** The version history in the CMS; listed here only when it no longer fits the row. */
  readonly historyUrl?: string | (() => void) | undefined;
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
 * The more options menu: the editor theme (hidden when the host fixes it), the block outlines
 * switch (the view state, also in the status bar), sample data, the shortcuts dialog with its key,
 * help (the help page, or the shortcuts when the host has none) and the links the row had no room
 * for.
 */
export function MoreMenu({
  compact,
  historyUrl: rawHistoryUrl,
  cmsUrl,
  sample,
  helpUrl,
  onOpenShortcuts,
}: MoreMenuProps) {
  const t = useT();
  const historyUrl = safeHistory(rawHistoryUrl);
  const theme = useTheme();
  const registry = useOptionalShortcutRegistry();
  const fromProvider = useOpenShortcuts();
  const openShortcuts = onOpenShortcuts ?? fromProvider;
  const [open, setOpen] = useState(false);
  const view = useViewState();
  const controller = usePersistence();
  const saveStatus = usePersistenceState((state) => state.status);
  const localeConfig = useLocaleState((state) => state.config);
  const locale = useLocaleState((state) => state.locale);
  const setLocale = useLocaleState((state) => state.setLocale);
  const helpCombo = registry?.keysFor('help.shortcuts')[0];
  const helpHint = useShortcutHint('help.shortcuts');
  const showTheme = theme !== undefined && !theme.forced;
  const hasLinks = cmsUrl !== undefined || historyUrl !== undefined;
  const hasShortcuts =
    openShortcuts !== undefined || (registry !== undefined && helpCombo !== undefined);

  const showShortcuts = () => {
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
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      contentClassName={compact === undefined ? 'bd-menu-popover' : 'bd-menu-popover bd-menu-touch'}
      label={t('toolbar.moreOptions')}
      trigger={<IconButton label={t('toolbar.moreOptions')} icon="ellipsis" variant="ghost" />}
    >
      <div className="bd-menu-list">
        {compact !== undefined && (
          <>
            <fieldset className="bd-menu-theme" aria-label={t('toolbar.breakpoints')}>
              <legend className="bd-menu-caption">{t('toolbar.breakpoints')}</legend>
              <div className="bd-segmented">
                {compact.breakpoints.map((item) => {
                  const key = BREAKPOINT_LABELS[item.id];
                  const icon = BREAKPOINT_ICONS[item.id];
                  const label = key === undefined ? item.id : t(key);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="bd-button bd-segment"
                      data-variant="ghost"
                      aria-pressed={item.id === compact.breakpoint}
                      aria-label={label}
                      title={label}
                      onClick={() => compact.onBreakpointChange(item.id)}
                    >
                      {icon === undefined ? label : <Icon name={icon} />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <hr className="bd-menu-separator" />
            {compact.onPreview !== undefined && (
              <button
                type="button"
                className="bd-menu-item"
                onClick={() => {
                  setOpen(false);
                  compact.onPreview?.();
                }}
              >
                <Icon name="eye" />
                <span className="bd-menu-item-label">{t('toolbar.preview.page')}</span>
              </button>
            )}
            {(saveStatus === 'dirty' || saveStatus === 'error') && (
              <button
                type="button"
                className="bd-menu-item"
                onClick={() => {
                  setOpen(false);
                  void controller.saveNow();
                }}
              >
                <Icon name="save" />
                <span className="bd-menu-item-label">{t('save.now')}</span>
              </button>
            )}
            {localeConfig.locales.length > 1 && (
              <fieldset className="bd-menu-theme" aria-label={t('locale.label')}>
                <legend className="bd-menu-caption">{t('locale.label')}</legend>
                {localeConfig.locales.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className="bd-menu-item"
                    aria-pressed={code === locale}
                    onClick={() => {
                      setOpen(false);
                      setLocale(code);
                      compact.onLocaleChange?.(code);
                    }}
                  >
                    <Icon name="globe" />
                    <span className="bd-menu-item-label">{localeConfig.intl[code] ?? code}</span>
                    <span className="bd-locale-code">{code.toUpperCase()}</span>
                  </button>
                ))}
              </fieldset>
            )}
            <hr className="bd-menu-separator" />
          </>
        )}
        {cmsUrl !== undefined && (
          <a className="bd-menu-item" href={cmsUrl}>
            <Icon name="arrow-left" /> {t('toolbar.backToCms')}
          </a>
        )}
        {typeof historyUrl === 'function' ? (
          <button
            type="button"
            className="bd-menu-item"
            onClick={() => {
              setOpen(false);
              historyUrl();
            }}
          >
            <Icon name="history" />
            <span className="bd-menu-item-label">{t('toolbar.versions')}</span>
          </button>
        ) : historyUrl !== undefined ? (
          <a className="bd-menu-item" href={historyUrl}>
            <Icon name="history" /> {t('toolbar.versions')}
          </a>
        ) : null}
        {hasLinks && <hr className="bd-menu-separator" />}
        {showTheme && (
          <>
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
            <hr className="bd-menu-separator" />
          </>
        )}
        <button
          type="button"
          className="bd-menu-item"
          aria-pressed={view.outlines}
          onClick={view.toggleOutlines}
        >
          <Icon name="square-dashed" />
          <span className="bd-menu-item-label">{t('toolbar.guides')}</span>
          <Kbd className="bd-menu-kbd" aria-hidden>
            {t(view.outlines ? 'statusBar.guides.on' : 'statusBar.guides.off')}
          </Kbd>
        </button>
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
        {(hasShortcuts || helpUrl !== undefined) && <hr className="bd-menu-separator" />}
        {hasShortcuts && (
          <button
            type="button"
            className="bd-menu-item"
            aria-haspopup="dialog"
            aria-keyshortcuts={helpCombo}
            onClick={showShortcuts}
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
        {helpUrl !== undefined ? (
          <a className="bd-menu-item" href={helpUrl} target="_blank" rel="noreferrer">
            <Icon name="circle-question-mark" />
            <span className="bd-menu-item-label">{t('toolbar.help')}</span>
          </a>
        ) : hasShortcuts ? (
          // Without a help page the help entry shows the shortcuts, the one help the editor has.
          <button
            type="button"
            className="bd-menu-item"
            aria-haspopup="dialog"
            onClick={showShortcuts}
          >
            <Icon name="circle-question-mark" />
            <span className="bd-menu-item-label">{t('toolbar.help')}</span>
          </button>
        ) : null}
      </div>
    </Popover>
  );
}
