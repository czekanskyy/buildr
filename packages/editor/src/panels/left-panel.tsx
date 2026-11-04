import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import { LEFT_PANEL_TABS, type LeftPanelTab } from '../app/contracts.ts';
import { useT } from '../messages/index.tsx';
import { Icon, IconButton, type IconName } from '../ui/index.ts';

export interface LeftPanelProps {
  readonly tab: LeftPanelTab;
  readonly onTabChange: (tab: LeftPanelTab) => void;
  readonly onCollapse: () => void;
  /** The Blocks tab (`InsertPanel`). */
  readonly blocks: ReactNode;
  /** The Structure tab (`LayersPanel`). */
  readonly structure: ReactNode;
}

const TAB_ICON: Record<LeftPanelTab, IconName> = {
  blocks: 'layout-grid',
  structure: 'list-tree',
};

/**
 * The left panel: Blocks and Structure tabs (a tablist with arrow-key roving), a collapse button
 * and the active tab's body. Only the active body is mounted.
 */
export function LeftPanel({ tab, onTabChange, onCollapse, blocks, structure }: LeftPanelProps) {
  const t = useT();
  const base = useId();
  const refs = useRef(new Map<LeftPanelTab, HTMLButtonElement>());
  const tabId = (value: LeftPanelTab) => `${base}-tab-${value}`;
  const panelId = `${base}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = LEFT_PANEL_TABS.indexOf(tab);
    const last = LEFT_PANEL_TABS.length - 1;
    let next: number;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    const value = LEFT_PANEL_TABS[next];
    if (value === undefined) return;
    onTabChange(value);
    refs.current.get(value)?.focus();
  };

  return (
    <aside className="bd-left-panel" aria-label={t('leftPanel.label')}>
      <div className="bd-left-panel-head">
        <div
          role="tablist"
          aria-label={t('leftPanel.tablistLabel')}
          className="bd-tabs-list"
          onKeyDown={onKeyDown}
        >
          {LEFT_PANEL_TABS.map((value) => (
            <button
              key={value}
              ref={(node) => {
                if (node === null) refs.current.delete(value);
                else refs.current.set(value, node);
              }}
              type="button"
              role="tab"
              id={tabId(value)}
              className="bd-tab"
              data-state={tab === value ? 'active' : 'inactive'}
              aria-selected={tab === value}
              aria-controls={tab === value ? panelId : undefined}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => onTabChange(value)}
            >
              <Icon name={TAB_ICON[value]} />
              {t(`leftPanel.tab.${value}`)}
            </button>
          ))}
        </div>
        <IconButton
          size="sm"
          icon="chevrons-left"
          label={t('leftPanel.collapse')}
          onClick={onCollapse}
        />
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(tab)}
        className="bd-left-panel-body"
        data-tab={tab}
      >
        {tab === 'blocks' ? blocks : structure}
      </div>
    </aside>
  );
}
