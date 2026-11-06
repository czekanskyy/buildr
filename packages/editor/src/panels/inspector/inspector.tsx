import type { ComponentMeta, PageNode, PropDef, Value } from '@next-buildr/core';
import { canEdit, createIndex, p as prop, valueSchema } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { RemoveRequest } from '../../app/contracts.ts';
import { componentMeta, useManifest } from '../../app/manifest.tsx';
import { MoveToDialog, useDragAvailable } from '../../dnd/index.ts';
import { interpolate, useT } from '../../messages/index.tsx';
import { hasDescendants } from '../../shortcuts/navigation.ts';
import {
  pathTo,
  structureLockedIds,
  useEditor,
  useEditorState,
  useSelectedNode,
} from '../../store/index.ts';
import {
  Button,
  ComponentIcon,
  Icon,
  IconButton,
  type IconName,
  Input,
  Popover,
  SearchField,
  Select,
  Tabs,
  useStructureLockedNotice,
} from '../../ui/index.ts';
import { AttributesField, AuthorOffNote, ClassesField, CssField } from './author-fields.tsx';
import { renderControl } from './controls/index.ts';
import { PropsPanel } from './props-panel.tsx';
import { readProp, translationLocale } from './value.ts';
import { TranslationBanner } from './values/translation.tsx';
import { ValueEditor } from './values/value-editor.tsx';

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

/** Accordion preferences are editor state; opening a group never changes the document. */
function AdvancedGroup({
  title,
  icon,
  searching,
  hidden,
  children,
}: {
  readonly title: string;
  readonly icon: IconName;
  readonly searching: boolean;
  readonly hidden?: boolean;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expanded = searching || open;
  return (
    <section className="bd-advanced-group" hidden={hidden}>
      <h4>
        <button
          type="button"
          className="bd-props-toggle"
          aria-expanded={expanded}
          onClick={() => setOpen(!open)}
        >
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
          <Icon name={icon} />
          {title}
        </button>
      </h4>
      <div hidden={!expanded}>{children}</div>
    </section>
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
    <div role="menu" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

const EXCERPT_LENGTH = 24;

/** A short, single-line excerpt of the node's own text (a plain string, never markup), for the subtitle. */
function textExcerpt(
  node: PageNode,
  meta: ComponentMeta | undefined,
  locale: string | undefined,
  defaultLocale: string | undefined,
): string | undefined {
  if (meta === undefined) return undefined;
  const entries = Object.entries(meta.props).filter(
    ([, def]) => def.kind === 'text' || def.kind === 'textarea',
  );
  const [name, def] = entries.find(([key]) => key === 'text') ?? entries[0] ?? [];
  if (name === undefined || def === undefined) return undefined;
  const reading = readProp(node, name, def, locale, defaultLocale);
  if (reading.mode !== 'static' || typeof reading.value !== 'string') return undefined;
  const text = reading.value.replace(/\s+/g, ' ').trim();
  if (text === '') return undefined;
  const chars = [...text];
  return chars.length > EXCERPT_LENGTH ? `${chars.slice(0, EXCERPT_LENGTH).join('')}…` : text;
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
  const notifyLocked = useStructureLockedNotice();
  /** A block locked for structure is not removed, moved or duplicated: say why. */
  const refuseLocked = () => {
    if (structureLockedIds(store.getState().doc, selectedIds).length === 0) return false;
    notifyLocked(selectedIds);
    return true;
  };
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
  const styleDisabled = readOnly || !canEdit(doc, createIndex(doc), node.id, 'style').ok;
  const excerpt = textExcerpt(node, meta, locale, defaultLocale);
  const parentId = pathTo(doc, node.id).at(-2);
  const parentNode = parentId === undefined ? undefined : doc.nodes[parentId];
  const parentName =
    parentNode === undefined
      ? undefined
      : (parentNode.name ?? componentMeta(manifest, parentNode.type)?.label ?? parentNode.type);
  const subtitle = [
    node.name ?? meta?.label ?? node.type,
    excerpt === undefined ? undefined : interpolate(t('inspector.excerpt'), { text: excerpt }),
    parentName === undefined
      ? undefined
      : interpolate(t('inspector.inBlock'), { name: parentName }),
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
            [
              'inspector.visibility.title',
              'inspector.condition.title',
              'inspector.position.title',
              'inspector.content.htmlElement',
              'inspector.css.title',
              'inspector.classes.title',
              'inspector.attributes.title',
              'inspector.author.off.title',
            ].some((key) => matches(t(key as Parameters<typeof t>[0]))) ||
            (node.visibleIf !== undefined && matches(t('inspector.attr.visibleIf'))))
        }
        onChange={write}
        onReset={reset}
        onSetValue={setValue}
        onFixed={fixed}
      />
    );
  };

  const search = (
    <SearchField
      className="bd-inspector-search"
      value={query}
      onChange={setQuery}
      label={t('inspector.search')}
      clearLabel={t('inspector.search')}
      placeholder={t('inspector.search.placeholder')}
    />
  );

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
    <div
      className="bd-inspector"
      data-state-controls={
        node.type.endsWith('/button') ||
        Object.keys(meta?.props ?? {}).some((key) => ['href', 'link', 'onClick'].includes(key)) ||
        Object.keys(node.styles?.state ?? {}).length > 0
      }
    >
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
                {menuItem('duplicate', 'copy', t('menu.duplicate'), () => {
                  if (!refuseLocked())
                    report(
                      store.dispatch({ type: 'node.duplicate', payload: { ids: selectedIds } }),
                    );
                })}
                {canMove
                  ? menuItem('move', 'corner-left-up', t('menu.moveTo'), () => {
                      if (!refuseLocked()) setMoving(true);
                    })
                  : null}
                {menuItem(
                  'delete',
                  'trash-2',
                  t('menu.delete'),
                  () => {
                    if (refuseLocked()) return;
                    if (onRemoveRequest !== undefined)
                      onRemoveRequest({
                        ids: selectedIds,
                        hasDescendants: hasDescendants(doc, selectedIds),
                      });
                    else
                      report(
                        store.dispatch({ type: 'node.remove', payload: { ids: selectedIds } }),
                      );
                  },
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
            content: (
              <>
                {search}
                {propsPanel('content')}
              </>
            ),
          },
          {
            value: 'style',
            icon: 'image',
            modified: node.styles !== undefined && Object.keys(node.styles).length > 0,
            label: t('inspector.tab.style'),
            content: (
              <>
                {search}
                {renderStyle?.(node, query) ?? (
                  <p className="bd-inspector-empty">{t('inspector.style.pending')}</p>
                )}
              </>
            ),
          },
          {
            value: 'advanced',
            icon: 'braces',
            label: t('inspector.tab.advanced'),
            content: (
              <>
                {search}
                {Object.entries(meta?.props ?? {})
                  .filter(([key]) => ['element', 'as', 'level'].includes(key))
                  .map(([key, def]) => (
                    <AdvancedGroup
                      key={key}
                      hidden={
                        !matches(t('inspector.content.htmlElement')) &&
                        !matches(t('inspector.content.tag'))
                      }
                      title={t('inspector.content.htmlElement')}
                      icon="braces"
                      searching={needle !== ''}
                    >
                      {renderControl(def, {
                        id: `${node.id}-${key}-tag`,
                        def,
                        label: t('inspector.content.tag'),
                        describedBy: undefined,
                        value: readProp(node, key, def, locale, defaultLocale).value,
                        disabled,
                        onChange: (value) => write(key, def, value),
                      })}
                      <p className="bd-field-hint">{t('inspector.content.tagHelp')}</p>
                      <p className="bd-field-hint">
                        <code>
                          {interpolate(t('inspector.content.tagOnPage'), {
                            tag: `<${key === 'level' ? 'h' : ''}${String(readProp(node, key, def, locale, defaultLocale).value)}>`,
                          })}
                        </code>
                      </p>
                    </AdvancedGroup>
                  ))}
                <AdvancedGroup
                  hidden={!matches(t('inspector.visibility.title'))}
                  title={t('inspector.visibility.title')}
                  icon="eye"
                  searching={needle !== ''}
                >
                  <p className="bd-field-label">{t('inspector.visibility.hideOnDevice')}</p>
                  <div className="bd-visibility-chips">
                    {(['desktop', 'tablet', 'mobile'] as const).map((device) => {
                      const layer = device === 'desktop' ? {} : { bp: device };
                      const hidden =
                        (device === 'desktop' ? node.styles?.base : node.styles?.bp?.[device])
                          ?.visibility?.hidden ?? false;
                      return (
                        <Button
                          key={device}
                          disabled={styleDisabled}
                          aria-pressed={hidden}
                          aria-label={interpolate(
                            t(
                              hidden
                                ? 'inspector.visibility.showOn'
                                : 'inspector.visibility.hideOn',
                            ),
                            { device: t(`inspector.device.${device}`) },
                          )}
                          onClick={() =>
                            report(
                              store.dispatch({
                                type: 'node.setStyle',
                                payload: {
                                  id: node.id,
                                  layer,
                                  group: 'visibility',
                                  property: 'hidden',
                                  value: !hidden,
                                },
                              }),
                            )
                          }
                        >
                          {t(`inspector.device.${device}`)}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="bd-field-hint">{t('inspector.visibility.help')}</p>
                </AdvancedGroup>
                <AdvancedGroup
                  hidden={!matches(t('inspector.condition.title'))}
                  title={t('inspector.condition.title')}
                  icon="sliders-vertical"
                  searching={needle !== ''}
                >
                  <ValueEditor
                    def={prop.boolean()}
                    label={t('inspector.condition.showWhen')}
                    raw={valueSchema(z.unknown()).safeParse(node.visibleIf).data}
                    disabled={disabled}
                    staticControl={null}
                    onSet={(value) => {
                      if (value.kind !== 'static')
                        report(
                          store.dispatch({
                            type: 'node.setAttr',
                            payload: { id: node.id, key: 'visibleIf', value },
                          }),
                        );
                    }}
                    onFixed={clearCondition}
                  />
                  {node.visibleIf !== undefined ? (
                    <Button variant="ghost" disabled={disabled} onClick={clearCondition}>
                      {t('inspector.attr.visibleIfRemove')}
                    </Button>
                  ) : null}
                </AdvancedGroup>
                <AdvancedGroup
                  hidden={!matches(t('inspector.position.title'))}
                  title={t('inspector.position.title')}
                  icon="move"
                  searching={needle !== ''}
                >
                  <Select
                    label={t('inspector.position.label')}
                    value={String(node.styles?.base?.layout?.position ?? 'static')}
                    disabled={styleDisabled}
                    options={(['static', 'relative', 'absolute', 'sticky', 'fixed'] as const).map(
                      (value) => ({ value, label: t(`inspector.position.${value}`) }),
                    )}
                    onValueChange={(value) =>
                      report(
                        store.dispatch({
                          type: 'node.setStyle',
                          payload: {
                            id: node.id,
                            layer: {},
                            group: 'layout',
                            property: 'position',
                            value,
                          },
                        }),
                      )
                    }
                  />
                  {(['top', 'right', 'bottom', 'left', 'zIndex'] as const).map((side) => (
                    <label
                      className="bd-advanced-position"
                      key={side}
                      htmlFor={`${node.id}-position-${side}`}
                    >
                      {t(`inspector.position.${side}`)}
                      <Input
                        key={`${node.id}-${side}-${String(side === 'zIndex' ? node.styles?.base?.layout?.zIndex : node.styles?.base?.layout?.inset?.[side])}`}
                        id={`${node.id}-position-${side}`}
                        aria-label={t(`inspector.position.${side}`)}
                        disabled={styleDisabled}
                        defaultValue={String(
                          side === 'zIndex'
                            ? (node.styles?.base?.layout?.zIndex ?? '')
                            : (node.styles?.base?.layout?.inset?.[side] ?? ''),
                        )}
                        onBlur={(event) => {
                          const value = event.target.value;
                          const payload = {
                            id: node.id,
                            layer: {},
                            group: 'layout',
                            property: side === 'zIndex' ? 'zIndex' : 'inset',
                            ...(side === 'zIndex' ? {} : { side }),
                          };
                          report(
                            store.dispatch(
                              value === ''
                                ? { type: 'node.unsetStyle', payload }
                                : {
                                    type: 'node.setStyle',
                                    payload: {
                                      ...payload,
                                      value: side === 'zIndex' ? Number(value) : value,
                                    },
                                  },
                            ),
                          );
                        }}
                      />
                    </label>
                  ))}
                </AdvancedGroup>
                <AdvancedGroup
                  hidden={
                    !matches(t('inspector.anchor.title')) &&
                    !matches(t('inspector.attr.name')) &&
                    !matches(t('inspector.attr.anchor'))
                  }
                  title={t('inspector.anchor.title')}
                  icon="link"
                  searching={needle !== ''}
                >
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
                  {node.anchor ? (
                    <p className="bd-field-hint">
                      {interpolate(t('inspector.anchor.help'), { link: `#${node.anchor}` })}
                    </p>
                  ) : null}
                </AdvancedGroup>
                {store.authorCode ? (
                  <>
                    <AdvancedGroup
                      hidden={!matches(t('inspector.css.title'))}
                      title={t('inspector.css.title')}
                      icon="braces"
                      searching={needle !== ''}
                    >
                      <CssField key={node.id} node={node} disabled={styleDisabled} />
                    </AdvancedGroup>
                    <AdvancedGroup
                      hidden={!matches(t('inspector.classes.title'))}
                      title={t('inspector.classes.title')}
                      icon="braces"
                      searching={needle !== ''}
                    >
                      <ClassesField key={node.id} node={node} disabled={styleDisabled} />
                    </AdvancedGroup>
                    <AdvancedGroup
                      hidden={!matches(t('inspector.attributes.title'))}
                      title={t('inspector.attributes.title')}
                      icon="braces"
                      searching={needle !== ''}
                    >
                      <AttributesField key={node.id} node={node} disabled={styleDisabled} />
                    </AdvancedGroup>
                  </>
                ) : (
                  <AdvancedGroup
                    hidden={!matches(t('inspector.author.off.title'))}
                    title={t('inspector.author.off.title')}
                    icon="lock"
                    searching={needle !== ''}
                  >
                    <AuthorOffNote
                      held={
                        node.customCss !== undefined ||
                        node.classes !== undefined ||
                        node.attributes !== undefined
                      }
                    />
                  </AdvancedGroup>
                )}
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
