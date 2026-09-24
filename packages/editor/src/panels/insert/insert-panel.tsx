import { type BuilderFragment, fromTree, instantiateTemplate } from '@buildr/core';
import { useMemo, useState } from 'react';
import { useManifest } from '../../app/manifest.tsx';
import { useDragPress } from '../../dnd/index.ts';
import { useT } from '../../messages/index.tsx';
import { useEditor, useEditorState } from '../../store/index.ts';
import { Input } from '../../ui/index.ts';
import {
  filterItems,
  groupByCategory,
  type PaletteItem,
  paletteItems,
  safeThumbnail,
} from './catalog.ts';
import { placeInsertion } from './target.ts';

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
  const [notice, setNotice] = useState<{ readonly ok: boolean; readonly text: string }>();

  const sections = useMemo(() => {
    if (manifest === undefined) return [];
    const { components, templates } = paletteItems(manifest);
    return [
      { id: 'components' as const, groups: groupByCategory(filterItems(components, query)) },
      { id: 'templates' as const, groups: groupByCategory(filterItems(templates, query)) },
    ];
  }, [manifest, query]);
  const empty = sections.every((section) => section.groups.length === 0);

  const press = useDragPress();

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
      setNotice({ ok: false, text: t('insert.readOnly') });
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
      setNotice({
        ok: false,
        text: `${t('insert.impossible')} ${placement.reason?.message ?? ''}`.trim(),
      });
      return;
    }
    const { parentId, slot, at } = placement.target;
    const result = store.dispatch({
      type: 'node.insert',
      payload: { parentId, slot, index: at, fragment },
    });
    if (!result.ok) {
      setNotice({ ok: false, text: result.error.message });
      return;
    }
    setNotice({ ok: true, text: `${t('insert.done')}: ${item.label}` });
    // The command gives the fragment fresh ids; the new node is the one now at the target position.
    const created = store.getState().doc.nodes[parentId]?.slots?.[slot]?.[at];
    if (created !== undefined) store.select(created);
  };

  return (
    <div className="bd-insert">
      <Input
        type="search"
        className="bd-insert-search"
        value={query}
        aria-label={t('insert.search')}
        placeholder={t('insert.search')}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="bd-insert-scroll">
        {empty ? <p className="bd-insert-empty">{t('insert.empty')}</p> : null}
        {sections.map((section) =>
          section.groups.length === 0 ? null : (
            <section key={section.id} className="bd-insert-section">
              <h3 className="bd-insert-heading">{t(`insert.${section.id}`)}</h3>
              {section.groups.map((group) => (
                // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only names a group of buttons
                <div key={group.category} role="group" aria-label={titleCase(group.category)}>
                  <h4 className="bd-insert-category">{titleCase(group.category)}</h4>
                  <ul className="bd-insert-list">
                    {group.items.map((item) => {
                      const thumbnail = safeThumbnail(item.thumbnail);
                      return (
                        <li key={`${item.kind}:${item.id}`}>
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
                            title={item.description}
                            onClick={() => insert(item)}
                          >
                            {thumbnail !== undefined ? (
                              <img
                                className="bd-insert-thumb"
                                src={thumbnail}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span
                                className="bd-insert-icon"
                                aria-hidden="true"
                                data-icon={item.icon}
                              >
                                {item.label.charAt(0)}
                              </span>
                            )}
                            <span className="bd-insert-label">{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ),
        )}
      </div>
      <div role="status" className="bd-insert-notice" data-ok={notice?.ok ?? true}>
        {notice?.text ?? ''}
      </div>
    </div>
  );
}
