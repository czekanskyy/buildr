import type { PageNode, PropDef, Value } from '@next-buildr/core';
import { canEdit, createIndex } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { RemoveRequest } from '../../app/contracts.ts';
import { componentMeta, useManifest } from '../../app/manifest.tsx';
import { MoveToDialog, useDragAvailable } from '../../dnd/index.ts';
import { interpolate, useT } from '../../messages/index.tsx';
import { hasDescendants } from '../../shortcuts/navigation.ts';
import { useEditor, useEditorState, useSelectedNode } from '../../store/index.ts';
import {
  Button,
  ComponentIcon,
  Icon,
  IconButton,
  type IconName,
  Input,
  Popover,
  SearchField,
  Tabs,
} from '../../ui/index.ts';
import { PropsPanel } from './props-panel.tsx';
import { translationLocale } from './value.ts';
import { TranslationBanner } from './values/translation.tsx';

export type InspectorTab = 'content' | 'style' | 'advanced';

export interface InspectorProps {
  /** The language being edited; translatable props write to it. */
  readonly locale?: string;
  readonly defaultLocale?: string;
  /** The Style tab (PB-082); without it the tab says the styles are edited elsewhere. */
  readonly renderStyle?: (node: PageNode, query: string) => ReactNode;
  /** The tab shown (controlled). Without it the inspector keeps its own. */
  readonly tab?: InspectorTab;
  readonly onTabChange?: (tab: InspectorTab) => void;
  /** Extra header buttons, placed before the more menu (the Style tab fills it). */
  readonly headerActions?: ReactNode;
  /** Shows the "Page settings" action of the empty state. */
  readonly onPageSettings?: () => void;
  /** Hands a removal to the shell (confirmation, Undo toast); without it the node is removed at once. */
  readonly onRemoveRequest?: (request: RemoveRequest) => void;
}

const TABS: readonly { readonly value: InspectorTab; readonly icon: IconName }[] = [
  { value: 'content', icon: 'type' },
  { value: 'style', icon: 'image' },
  { value: 'advanced', icon: 'braces' },
];

const isTab = (value: string): value is InspectorTab => TABS.some((entry) => entry.value === value);

export interface InspectorRailProps {
  readonly tab: InspectorTab;
  readonly onTabChange: (tab: InspectorTab) => void;
  readonly onExpand: () => void;
}

/** The collapsed inspector: the tabs as vertical icon buttons; a click opens the panel on that tab. */
export function InspectorRail({ tab, onTabChange, onExpand }: InspectorRailProps) {
  const t = useT();
  const names = {
    content: t('inspector.tab.content'),
    style: t('inspector.tab.style'),
    advanced: t('inspector.tab.advanced'),
  } as const;
  return (
    <div className="bd-inspector-rail">
      <IconButton
        variant="ghost"
        icon="panel-right"
        label={t('inspector.expand')}
        onClick={onExpand}
      />
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('inspector.tabs')}
        className="bd-inspector-rail-tabs"
      >
        {TABS.map((entry) => (
          <IconButton
            key={entry.value}
            variant="ghost"
            icon={entry.icon}
            role="tab"
            aria-selected={tab === entry.value}
            label={names[entry.value]}
            onClick={() => {
              onTabChange(entry.value);
              onExpand();
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** A text attribute of the node (`name`, `anchor`); clearing it removes it. */
function AttrField(props: {
  readonly nodeId: string;
  readonly attr: 'name' | 'anchor';
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly onChange: (attr: 'name' | 'anchor', value: string) => void;
}) {
  // What is typed stays on screen even when the command refuses it (an anchor with a capital).
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shown = draft ?? props.value;
  const id = `${props.nodeId}-${props.attr}`;
  return (
    <div className="bd-field" data-attr={props.attr} data-layout="row">
      <div className="bd-field-head">
        <label className="bd-field-label" htmlFor={id}>
          {props.label}
        </label>
      </div>
      <div className="bd-field-body">
        <Input
          id={id}
          value={shown}
          disabled={props.disabled}
          placeholder={props.placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            props.onChange(props.attr, event.target.value);
          }}
          onBlur={() => setDraft(undefined)}
        />
      </div>
    </div>
  );
}

/** The "more actions" menu: items are menuitems, arrows wrap, Home and End jump, focus starts on the first. */
function ActionMenu({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = () =>
    Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
  // biome-ignore lint/correctness/useExhaustiveDependencies: focuses the first item once, on open
  useEffect(() => {
    items()[0]?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % list.length;
    else if (event.key === 'ArrowUp') next = at <= 0 ? list.length - 1 : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else return;
    event.preventDefault();
    list[next]?.focus();
  };
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the menu role owns the arrow-key navigation of its items
    <div role="menu" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/**
 * The properties of the selected node (docs/editor.md#inspector): Content (the component's props
 * as controls), Style and Advanced (name, anchor, the display condition, and the props the
 * component puts in the "advanced" or "accessibility" group).
 */
export function Inspector({
  locale,
  defaultLocale,
  renderStyle,
  tab: controlledTab,
  onTabChange,
  headerActions,
  onPageSettings,
  onRemoveRequest,
}: InspectorProps) {
  const t = useT();
  const store = useEditor();
  const manifest = useManifest();
  const node = useSelectedNode();
  const doc = useEditorState((state) => state.doc);
  const readOnly = useEditorState((state) => state.readOnly);
  const selectedIds = useEditorState((state) => state.selectedIds);
  const count = selectedIds.length;
  const [notice, setNotice] = useState('');
  const [innerTab, setInnerTab] = useState<InspectorTab>('content');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const canMove = useDragAvailable();
  const tab = controlledTab ?? innerTab;

  if (node === undefined) {
    return (
      <div className="bd-inspector">
        <div className="bd-inspector-empty" data-state="nothing">
          <Icon name="mouse-pointer-click" size="md" />
          <p className="bd-inspector-empty-title">{t('inspector.empty')}</p>
          <p className="bd-inspector-empty-hint">{t('inspector.emptyHint')}</p>
          {onPageSettings !== undefined ? (
            <Button className="bd-inspector-page-settings" onClick={onPageSettings}>
              <Icon name="sliders-vertical" />
              {t('inspector.pageSettings')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  const meta = componentMeta(manifest, node.type);
  const locked = !canEdit(doc, createIndex(doc), node.id, 'content').ok;
  const disabled = readOnly || locked;
  const parentId = createIndex(doc).parentOf[node.id];
  const parent = parentId === undefined ? undefined : doc.nodes[parentId];
  const parentLabel =
    parent === undefined
      ? undefined
      : (parent.name ?? componentMeta(manifest, parent.type)?.label ?? parent.type);
  const subtitle = [
    node.name ?? node.type,
    parentLabel === undefined
      ? undefined
      : interpolate(t('inspector.inBlock'), { name: parentLabel }),
  ]
    .filter((x) => x !== undefined)
    .join(' · ');
  const needle = query.trim().toLowerCase();
  const matches = (label: string) => needle === '' || label.toLowerCase().includes(needle);

  const report = (result: {
    readonly ok: boolean;
    readonly error?: { readonly message: string };
  }) => setNotice(result.ok ? '' : (result.error?.message ?? ''));

  const write = (prop: string, def: PropDef, value: unknown) => {
    const target = translationLocale(def, locale, defaultLocale);
    const translate: Command = {
      type: 'node.setProp',
      payload: {
        id: node.id,
        prop,
        value: { kind: 'static', value },
        ...(target !== undefined ? { locale: target } : {}),
      },
    };
    // A translation hangs off a fixed value, so a prop still at its default gets that first.
    const current =
      node.props !== undefined && Object.hasOwn(node.props, prop) ? node.props[prop] : undefined;
    if (target !== undefined && current?.kind !== 'static') {
      const base: Command = {
        type: 'node.setProp',
        payload: { id: node.id, prop, value: { kind: 'static', value: def.default } },
      };
      report(store.dispatchBatch([base, translate], { label: 'node.setProp' }));
      return;
    }
    report(store.dispatch(translate));
  };
  // A binding or a formula is the prop's value in the default language; translations belong to fixed values.
  const setValue = (prop: string, _def: PropDef, value: Value) =>
    report(store.dispatch({ type: 'node.setProp', payload: { id: node.id, prop, value } }));
  const fixed = (prop: string, def: PropDef) =>
    report(
      store.dispatch({
        type: 'node.setProp',
        payload: { id: node.id, prop, value: { kind: 'static', value: def.default } },
      }),
    );
  const reset = (prop: string, def: PropDef) => {
    const target = translationLocale(def, locale, defaultLocale);
    report(
      store.dispatch({
        type: 'node.unsetProp',
        payload: { id: node.id, prop, ...(target !== undefined ? { locale: target } : {}) },
      }),
    );
  };
  const setAttr = (attr: 'name' | 'anchor', value: string) =>
    report(
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: node.id, key: attr, value: value === '' ? null : value },
      }),
    );
  const clearCondition = () =>
    report(
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: node.id, key: 'visibleIf', value: null },
      }),
    );

  const propsPanel = (scope: 'content' | 'advanced') => {
    if (meta === undefined) {
      return scope === 'content' ? (
        <p className="bd-inspector-empty">{t('inspector.unknownComponent')}</p>
      ) : null;
    }
    return (
      <PropsPanel
        node={node}
        meta={meta}
        scope={scope}
        locale={locale}
        defaultLocale={defaultLocale}
        disabled={disabled}
        query={needle}
        othersMatch={
          scope === 'advanced' &&
          (matches(t('inspector.attr.name')) ||
            matches(t('inspector.attr.anchor')) ||
            (node.visibleIf !== undefined && matches(t('inspector.attr.visibleIf'))))
        }
        onChange={write}
        onReset={reset}
        onSetValue={setValue}
        onFixed={fixed}
      />
    );
  };

  const menuItem = (
    id: string,
    icon: IconName,
    label: string,
    onSelect: () => void,
    danger = false,
  ) => (
    <button
      key={id}
      type="button"
      role="menuitem"
      className="bd-menu-item"
      data-danger={danger ? '' : undefined}
      disabled={disabled}
      onClick={() => {
        setMenuOpen(false);
        onSelect();
      }}
    >
      <Icon name={icon} />
      <span className="bd-menu-item-label">{label}</span>
    </button>
  );

  return (
    <div className="bd-inspector">
      <header className="bd-inspector-head">
        <div className="bd-inspector-headline">
          <span className="bd-inspector-icon">
            <ComponentIcon meta={meta} size="md" />
          </span>
          <div className="bd-inspector-titles">
            <h3 className="bd-inspector-title">{meta?.label ?? node.type}</h3>
            <small className="bd-inspector-subtitle">{subtitle}</small>
          </div>
          <div className="bd-inspector-actions">
            {headerActions}
            <Popover
              open={menuOpen}
              onOpenChange={setMenuOpen}
              align="end"
              label={t('inspector.moreActions')}
              contentClassName="bd-menu"
              trigger={
                <IconButton
                  variant="ghost"
                  icon="ellipsis"
                  label={t('inspector.moreActions')}
                  aria-haspopup="menu"
                />
              }
            >
              <ActionMenu label={t('inspector.moreActions')}>
                {menuItem('duplicate', 'copy', t('menu.duplicate'), () =>
                  report(store.dispatch({ type: 'node.duplicate', payload: { ids: selectedIds } })),
                )}
                {canMove
                  ? menuItem('move', 'corner-left-up', t('menu.moveTo'), () => setMoving(true))
                  : null}
                {menuItem(
                  'delete',
                  'trash-2',
                  t('menu.delete'),
                  () =>
                    onRemoveRequest !== undefined
                      ? onRemoveRequest({
                          ids: selectedIds,
                          hasDescendants: hasDescendants(doc, selectedIds),
                        })
                      : report(
                          store.dispatch({ type: 'node.remove', payload: { ids: selectedIds } }),
                        ),
                  true,
                )}
              </ActionMenu>
            </Popover>
          </div>
        </div>
        {count > 1 ? (
          <p className="bd-inspector-count">{`${count} ${t('inspector.selected')}`}</p>
        ) : null}
        {locked ? <p className="bd-inspector-locked">{t('inspector.locked')}</p> : null}
      </header>
      <TranslationBanner locale={locale} defaultLocale={defaultLocale} />
      <SearchField
        className="bd-inspector-search"
        value={query}
        onChange={setQuery}
        label={t('inspector.search')}
        clearLabel={t('inspector.search')}
        placeholder={t('inspector.search.placeholder')}
      />
      <Tabs
        label={t('inspector.tabs')}
        value={tab}
        onValueChange={(next) => {
          if (!isTab(next)) return;
          setInnerTab(next);
          onTabChange?.(next);
        }}
        items={[
          {
            value: 'content',
            icon: 'type',
            label: t('inspector.tab.content'),
            content: propsPanel('content'),
          },
          {
            value: 'style',
            icon: 'image',
            modified: node.styles !== undefined && Object.keys(node.styles).length > 0,
            label: t('inspector.tab.style'),
            content: renderStyle?.(node, query) ?? (
              <p className="bd-inspector-empty">{t('inspector.style.pending')}</p>
            ),
          },
          {
            value: 'advanced',
            icon: 'braces',
            label: t('inspector.tab.advanced'),
            content: (
              <>
                {matches(t('inspector.attr.name')) ? (
                  <AttrField
                    key={`${node.id}-name`}
                    nodeId={node.id}
                    attr="name"
                    label={t('inspector.attr.name')}
                    value={node.name ?? ''}
                    disabled={disabled}
                    onChange={setAttr}
                  />
                ) : null}
                {matches(t('inspector.attr.anchor')) ? (
                  <AttrField
                    key={`${node.id}-anchor`}
                    nodeId={node.id}
                    attr="anchor"
                    label={t('inspector.attr.anchor')}
                    value={node.anchor ?? ''}
                    disabled={disabled}
                    placeholder={t('inspector.htmlId.placeholder')}
                    onChange={setAttr}
                  />
                ) : null}
                {node.visibleIf !== undefined && matches(t('inspector.attr.visibleIf')) ? (
                  <div className="bd-field bd-note bd-note--info" data-attr="visibleIf">
                    <Icon name="eye" />
                    <div className="bd-note-text">
                      <span className="bd-field-label">{t('inspector.attr.visibleIf')}</span>
                      <p className="bd-field-chip">{t('inspector.attr.visibleIfSet')}</p>
                    </div>
                    <Button variant="ghost" disabled={disabled} onClick={clearCondition}>
                      {t('inspector.attr.visibleIfRemove')}
                    </Button>
                  </div>
                ) : null}
                {propsPanel('advanced')}
              </>
            ),
          },
        ]}
      />
      <div role="status" className="bd-inspector-notice">
        {notice}
      </div>
      {canMove ? <MoveToDialog open={moving} onOpenChange={setMoving} ids={selectedIds} /> : null}
    </div>
  );
}
