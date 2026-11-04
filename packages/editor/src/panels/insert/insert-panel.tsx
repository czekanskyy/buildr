import {
  type BuilderFragment,
  fromTree,
  instantiateTemplate,
  registryVersions,
} from '@next-buildr/core';
import { type PointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteMode } from '../../app/contracts.ts';
import { useManifest } from '../../app/manifest.tsx';
import { useDragPress } from '../../dnd/index.ts';
import { usePlural, useT } from '../../messages/index.tsx';
import { isTypingTarget } from '../../shortcuts/index.ts';
import { useEditor, useEditorState } from '../../store/index.ts';
import {
  ComponentIcon,
  Icon,
  SearchField,
  SegmentedControl,
  Tooltip,
  useToast,
} from '../../ui/index.ts';
import {
  filterItems,
  groupByCategory,
  type PaletteItem,
  paletteItems,
  safeThumbnail,
} from './catalog.ts';
import { categoryName } from './category-name.ts';
import { readCollapsed, readRecent, withRecent, writeCollapsed, writeRecent } from './storage.ts';
import { placeInsertion } from './target.ts';

const SKELETONS = ['a', 'b', 'c', 'd'] as const;
const RECENT_ID = 'recent';

/** The label split around the first match of the query, for highlighting. */
function splitMatch(label: string, query: string): readonly [string, string, string] {
  const needle = query.trim().toLowerCase();
  const at = needle === '' ? -1 : label.toLowerCase().indexOf(needle);
  return at === -1
    ? [label, '', '']
    : [label.slice(0, at), label.slice(at, at + needle.length), label.slice(at + needle.length)];
}

export interface InsertPanelProps {
  /** Blocks or patterns; leave out for a panel that keeps the choice itself. */
  readonly mode?: PaletteMode;
  readonly onModeChange?: (mode: PaletteMode) => void;
  /** Receives the search input, so the shell can focus it (the `/` shortcut, the empty page's "Add block"). */
  readonly searchRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The block and pattern palette (docs/editor.md#insert): a Blocks / Patterns switch, search, the
 * insert target, "Recently used" and collapsible groups. A click (or Enter) inserts at the first
 * position the rules allow: inside the selected container, else after the selection. It never needs
 * drag and drop. When nothing fits the reason is shown instead.
 */
export function InsertPanel({
  mode: modeProp,
  onModeChange,
  searchRef: searchRefProp,
}: InsertPanelProps = {}) {
  const t = useT();
  const plural = usePlural();
  const store = useEditor();
  const manifest = useManifest();
  const selectedId = useEditorState((state) => state.anchorId);
  const selectedNode = useEditorState((state) =>
    state.anchorId === null ? undefined : state.doc.nodes[state.anchorId],
  );
  const rootId = useEditorState((state) => state.doc.root);
  const readOnly = useEditorState((state) => state.readOnly);
  const [query, setQuery] = useState('');
  const [ownMode, setOwnMode] = useState<PaletteMode>('blocks');
  const mode = modeProp ?? ownMode;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(readCollapsed);
  const [recent, setRecent] = useState<readonly string[]>(readRecent);
  const ownSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = searchRefProp ?? ownSearchRef;
  const toast = useToast();

  const chooseMode = (next: PaletteMode) => {
    setOwnMode(next);
    onModeChange?.(next);
  };

  const palette = useMemo(
    () => (manifest === undefined ? undefined : paletteItems(manifest)),
    [manifest],
  );
  const patterns = mode === 'patterns';
  const source = patterns ? palette?.templates : palette?.components;
  const searching = query.trim() !== '';
  const loading = manifest === undefined;
  const results = useMemo(
    () => (searching && source !== undefined ? filterItems(source, query) : []),
    [searching, source, query],
  );
  const groups = useMemo(
    () => (!searching && source !== undefined ? groupByCategory(source) : []),
    [searching, source],
  );
  const recentItems = useMemo(() => {
    const byType = new Map((palette?.components ?? []).map((item) => [item.id, item]));
    return recent.flatMap((type) => byType.get(type) ?? []);
  }, [palette, recent]);

  const press = useDragPress();

  // `/` jumps to the search, unless the keyboard already belongs to a field or an editable region.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchRef]);

  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      writeCollapsed(next);
      return next;
    });

  const fragmentOf = (item: PaletteItem): BuilderFragment | undefined => {
    const versions = registryVersions(store.registry);
    if (item.kind === 'template') {
      const definition = manifest?.templates[item.id];
      return definition === undefined
        ? undefined
        : instantiateTemplate(definition, undefined, undefined, versions);
    }
    const meta = manifest?.components[item.id];
    if (meta === undefined) return undefined;
    return fromTree(
      {
        type: meta.type,
        ...(meta.defaults?.slots !== undefined ? { slots: meta.defaults.slots } : {}),
      },
      undefined,
      versions,
    );
  };

  const insert = (item: PaletteItem) => {
    if (readOnly) {
      toast.show({ id: 'insert', variant: 'warning', message: t('insert.readOnly') });
      return;
    }
    const fragment = fragmentOf(item);
    if (fragment === undefined) return;
    const state = store.getState();
    const placement = placeInsertion(
      state.doc,
      store.registry,
      state.selectedIds.at(-1) ?? null,
      fragment,
    );
    if (!placement.ok) {
      toast.show({
        id: 'insert',
        variant: 'warning',
        message: `${t('insert.impossible')} ${placement.reason?.message ?? ''}`.trim(),
      });
      return;
    }
    const { parentId, slot, at } = placement.target;
    const result = store.dispatch({
      type: 'node.insert',
      payload: { parentId, slot, index: at, fragment },
    });
    if (!result.ok) {
      toast.show({ id: 'insert', variant: 'error', message: result.error.message });
      return;
    }
    toast.show({
      id: 'insert',
      variant: 'success',
      message: t('insert.done.named').replace('{name}', () => item.label),
    });
    if (item.kind === 'component') {
      const next = withRecent(recent, item.id);
      setRecent(next);
      writeRecent(next);
    }
    // The command gives the fragment fresh ids; the new node is the one now at the target position.
    const created = store.getState().doc.nodes[parentId]?.slots?.[slot]?.[at];
    if (created !== undefined) store.select(created);
  };

  const onPress = (item: PaletteItem, event: PointerEvent<HTMLButtonElement>) => {
    if (readOnly) return;
    press?.(
      item.kind === 'template'
        ? { kind: 'template', id: item.id }
        : { kind: 'component', type: item.id },
      item.label,
      event,
    );
  };

  const addLabel = (item: PaletteItem) =>
    t(item.kind === 'template' ? 'patterns.insert' : 'blocks.add').replace(
      '{name}',
      () => item.label,
    );

  const glyph = (item: PaletteItem) => {
    const thumbnail = safeThumbnail(item.thumbnail);
    return item.kind === 'template' ? (
      <span className="bd-insert-thumb" aria-hidden="true">
        {thumbnail !== undefined ? (
          <img src={thumbnail} alt="" loading="lazy" />
        ) : (
          <ComponentIcon meta={{ icon: 'layout-template' }} size="md" />
        )}
      </span>
    ) : (
      <span className="bd-insert-icon" aria-hidden="true" data-icon={item.icon}>
        <ComponentIcon meta={{ icon: item.icon }} size="md" />
      </span>
    );
  };

  const renderTile = (item: PaletteItem, keyPrefix: string) => {
    const button = (
      <button
        type="button"
        className="bd-insert-item"
        aria-label={addLabel(item)}
        onPointerDown={(event) => onPress(item, event)}
        data-kind={item.kind}
        data-id={item.id}
        onClick={() => insert(item)}
      >
        {glyph(item)}
        <Icon name="ellipsis" className="bd-insert-grip" aria-hidden="true" />
        <span className="bd-insert-label">{item.label}</span>
      </button>
    );
    return (
      <li key={`${keyPrefix}:${item.kind}:${item.id}`}>
        {item.description === undefined ? (
          button
        ) : (
          <Tooltip content={item.description}>{button}</Tooltip>
        )}
      </li>
    );
  };

  const renderResult = (item: PaletteItem) => {
    const [pre, mid, post] = splitMatch(item.label, query);
    return (
      <li key={`${item.kind}:${item.id}`}>
        <button
          type="button"
          className="bd-insert-item bd-insert-result"
          aria-label={addLabel(item)}
          onPointerDown={(event) => onPress(item, event)}
          data-kind={item.kind}
          data-id={item.id}
          onClick={() => insert(item)}
        >
          {glyph(item)}
          <span className="bd-insert-result-text">
            <span className="bd-insert-label">
              {pre}
              {mid === '' ? null : <mark className="bd-insert-mark">{mid}</mark>}
              {post}
            </span>
            <span className="bd-insert-result-cat">{categoryName(t, item.category)}</span>
            {item.description !== undefined ? (
              <span className="bd-insert-desc">{item.description}</span>
            ) : null}
          </span>
        </button>
      </li>
    );
  };

  const renderGroup = (
    key: string,
    name: string,
    items: readonly PaletteItem[],
    kind: 'component' | 'template',
    empty?: string,
  ) => {
    const open = !collapsed.has(key);
    const listId = `bd-insert-${key.replace(/[^\w-]/g, '-')}`;
    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only names a group of buttons
      <div key={key} role="group" aria-label={name} className="bd-insert-group">
        <h4 className="bd-insert-category">
          <button
            type="button"
            className="bd-insert-category-toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => toggleGroup(key)}
          >
            <Icon name={open ? 'chevron-down' : 'chevron-right'} />
            <span className="bd-insert-category-name">{name}</span>
            <span className="bd-insert-count">{items.length}</span>
          </button>
        </h4>
        <ul className="bd-insert-list" id={listId} data-kind={kind} hidden={!open}>
          {items.map((item) => renderTile(item, key))}
        </ul>
        {empty !== undefined && items.length === 0 && open ? (
          <p className="bd-insert-shell">{empty}</p>
        ) : null}
      </div>
    );
  };

  const kind = patterns ? 'template' : 'component';
  const label = t(patterns ? 'patterns.search' : 'blocks.search');
  const targetName =
    selectedNode === undefined
      ? undefined
      : selectedId === rootId
        ? t('blocks.target.page')
        : (selectedNode.name ??
          manifest?.components[selectedNode.type]?.label ??
          selectedNode.type);

  return (
    <div className="bd-insert" data-view="grid" data-mode={mode}>
      <SegmentedControl
        className="bd-seg--full"
        label={t('leftPanel.kind')}
        value={mode}
        onValueChange={(next) => chooseMode(next === 'patterns' ? 'patterns' : 'blocks')}
        options={[
          { value: 'blocks', label: t('leftPanel.mode.blocks') },
          { value: 'patterns', label: t('leftPanel.mode.patterns') },
        ]}
      />
      <SearchField
        ref={searchRef}
        value={query}
        onChange={setQuery}
        label={label}
        clearLabel={t('blocks.search.clear')}
        placeholder={label}
        hint="/"
      />
      <div className="bd-insert-target" role="status" data-node-id={selectedId ?? undefined}>
        <Icon name="arrow-right" aria-hidden="true" />
        <span>
          {targetName === undefined ? (
            t('leftPanel.insertAtEnd')
          ) : (
            <>
              {t('blocks.insertAfter')} <b>{targetName}</b>
            </>
          )}
        </span>
      </div>
      <div className="bd-insert-scroll">
        {loading ? (
          <section className="bd-insert-section" aria-busy="true">
            <ul className="bd-insert-list" data-kind="template" aria-hidden="true">
              {SKELETONS.map((key) => (
                <li key={key} className="bd-insert-skeleton" />
              ))}
            </ul>
          </section>
        ) : null}
        {searching && !loading && results.length > 0 ? (
          <>
            <p className="bd-insert-results-count" role="status">
              {plural('blocks.results', results.length)}
            </p>
            <ul className="bd-insert-results" data-kind={kind}>
              {results.map(renderResult)}
            </ul>
          </>
        ) : null}
        {searching && !loading && results.length === 0 ? (
          <p className="bd-insert-empty">
            {t('blocks.empty').replace('{query}', () => query.trim())}
            {patterns ? null : (
              <>
                {' '}
                {t('blocks.empty.check')}{' '}
                <button
                  type="button"
                  className="bd-insert-link"
                  onClick={() => chooseMode('patterns')}
                >
                  {t('blocks.empty.patterns')}
                </button>
              </>
            )}
          </p>
        ) : null}
        {!searching && !loading ? (
          <>
            {patterns || recentItems.length === 0
              ? null
              : renderGroup(RECENT_ID, t('blocks.recent'), recentItems, 'component')}
            {groups.map((group) =>
              renderGroup(
                `${kind}s:${group.category}`,
                categoryName(t, group.category),
                group.items,
                kind,
              ),
            )}
            {patterns
              ? renderGroup(
                  'patterns:mine',
                  t('patterns.cat.mine'),
                  [],
                  'template',
                  t('patterns.empty'),
                )
              : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
