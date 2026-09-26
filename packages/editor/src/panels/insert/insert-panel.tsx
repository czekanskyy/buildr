import { type BuilderFragment, fromTree, instantiateTemplate } from '@next-buildr/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useManifest } from '../../app/manifest.tsx';
import { useDragPress } from '../../dnd/index.ts';
import { useT } from '../../messages/index.tsx';
import { isTypingTarget } from '../../shortcuts/index.ts';
import { useEditor, useEditorState } from '../../store/index.ts';
import { ComponentIcon, Icon, IconButton, Input, Tooltip, useToast } from '../../ui/index.ts';
import {
  filterItems,
  groupByCategory,
  type PaletteItem,
  paletteItems,
  safeThumbnail,
} from './catalog.ts';
import { placeInsertion } from './target.ts';

type View = 'grid' | 'list';
const VIEW_KEY = 'buildr.editor.insert.view';
const SKELETONS = ['a', 'b', 'c', 'd'] as const;

function readView(): View {
  try {
    return globalThis.localStorage?.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function writeView(view: View): void {
  try {
    globalThis.localStorage?.setItem(VIEW_KEY, view);
  } catch {
    // Storage can be blocked; the choice then only lasts for this session.
  }
}

const titleCase = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

/**
 * The component and template palette (docs/editor.md#insert): search, categories, and a click (or
 * Enter) that inserts at the first position the rules allow — inside the selected container, else
 * after the selection. It never needs drag and drop. When nothing fits the reason is shown instead.
 */
export function InsertPanel() {
  const t = useT();
  const store = useEditor();
  const manifest = useManifest();
  const readOnly = useEditorState((state) => state.readOnly);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(readView);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const sections = useMemo(() => {
    if (manifest === undefined) return [];
    const { components, templates } = paletteItems(manifest);
    return [
      { id: 'components' as const, groups: groupByCategory(filterItems(components, query)) },
      { id: 'templates' as const, groups: groupByCategory(filterItems(templates, query)) },
    ];
  }, [manifest, query]);
  const loading = manifest === undefined;
  const searching = query.trim() !== '';
  const empty = !loading && sections.every((section) => section.groups.length === 0);

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
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    writeView(next);
  };
  const toggleCategory = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const fragmentOf = (item: PaletteItem): BuilderFragment | undefined => {
    if (item.kind === 'template') {
      const definition = manifest?.templates[item.id];
      return definition === undefined ? undefined : instantiateTemplate(definition);
    }
    const meta = manifest?.components[item.id];
    if (meta === undefined) return undefined;
    return fromTree({
      type: meta.type,
      ...(meta.defaults?.slots !== undefined ? { slots: meta.defaults.slots } : {}),
    });
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
    toast.show({ id: 'insert', variant: 'success', message: `${t('insert.done')}: ${item.label}` });
    // The command gives the fragment fresh ids; the new node is the one now at the target position.
    const created = store.getState().doc.nodes[parentId]?.slots?.[slot]?.[at];
    if (created !== undefined) store.select(created);
  };

  const renderItem = (item: PaletteItem) => {
    const thumbnail = safeThumbnail(item.thumbnail);
    const button = (
      <button
        type="button"
        className="bd-insert-item"
        onPointerDown={(event) => {
          if (readOnly) return;
          press?.(
            item.kind === 'template'
              ? { kind: 'template', id: item.id }
              : { kind: 'component', type: item.id },
            item.label,
            event,
          );
        }}
        data-kind={item.kind}
        data-id={item.id}
        onClick={() => insert(item)}
      >
        {item.kind === 'template' ? (
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
        )}
        <span className="bd-insert-label">{item.label}</span>
        {view === 'list' && item.description !== undefined ? (
          <span className="bd-insert-desc" aria-hidden="true">
            {item.description}
          </span>
        ) : null}
      </button>
    );
    return (
      <li key={`${item.kind}:${item.id}`}>
        {item.description === undefined ? (
          button
        ) : (
          <Tooltip content={item.description}>{button}</Tooltip>
        )}
      </li>
    );
  };

  return (
    <div className="bd-insert" data-view={view}>
      <div className="bd-insert-bar">
        <div className="bd-insert-searchbox">
          <Icon name="search" className="bd-insert-search-icon" />
          <Input
            ref={searchRef}
            type="search"
            className="bd-insert-search"
            value={query}
            aria-label={t('insert.search')}
            aria-keyshortcuts="/"
            placeholder={t('insert.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query === '' ? null : (
            <IconButton
              className="bd-insert-clear"
              label={t('insert.clear')}
              icon="x"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            />
          )}
        </div>
        <div className="bd-insert-views">
          <IconButton
            label={t('insert.view.grid')}
            icon="layout-grid"
            aria-pressed={view === 'grid'}
            onClick={() => chooseView('grid')}
          />
          <IconButton
            label={t('insert.view.list')}
            icon="list"
            aria-pressed={view === 'list'}
            onClick={() => chooseView('list')}
          />
        </div>
      </div>
      <div className="bd-insert-scroll">
        {empty ? <p className="bd-insert-empty">{t('insert.empty')}</p> : null}
        {loading ? (
          <section className="bd-insert-section" aria-busy="true">
            <h3 className="bd-insert-heading">{t('insert.templates')}</h3>
            <ul className="bd-insert-list" data-kind="template" aria-hidden="true">
              {SKELETONS.map((key) => (
                <li key={key} className="bd-insert-skeleton" />
              ))}
            </ul>
          </section>
        ) : null}
        {sections.map((section) =>
          section.groups.length === 0 ? null : (
            <section key={section.id} className="bd-insert-section">
              <h3 className="bd-insert-heading">{t(`insert.${section.id}`)}</h3>
              {section.groups.map((group) => {
                const key = `${section.id}:${group.category}`;
                const open = searching || !collapsed.has(key);
                const name = titleCase(group.category);
                const listId = `bd-insert-${section.id}-${group.category}`;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only names a group of buttons
                  <div key={key} role="group" aria-label={name} className="bd-insert-group">
                    <h4 className="bd-insert-category">
                      <button
                        type="button"
                        className="bd-insert-category-toggle"
                        aria-expanded={open}
                        aria-controls={listId}
                        onClick={() => toggleCategory(key)}
                      >
                        <Icon name={open ? 'chevron-down' : 'chevron-right'} />
                        <span className="bd-insert-category-name">{name}</span>
                        <span className="bd-insert-count">{group.items.length}</span>
                      </button>
                    </h4>
                    <ul
                      className="bd-insert-list"
                      id={listId}
                      data-kind={section.id === 'templates' ? 'template' : 'component'}
                      hidden={!open}
                    >
                      {group.items.map(renderItem)}
                    </ul>
                  </div>
                );
              })}
            </section>
          ),
        )}
      </div>
    </div>
  );
}
