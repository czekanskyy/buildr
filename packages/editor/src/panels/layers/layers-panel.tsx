import type { NodeId } from '@buildr/core';
import type { Command } from '@buildr/core/commands';
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { componentMeta, useManifest } from '../../app/manifest.tsx';
import {
  MoveToDialog,
  useDragAutoscroll,
  useDragAvailable,
  useDragPress,
  useDragState,
  useRegisterTree,
} from '../../dnd/index.ts';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { pathTo, useEditor, useEditorState } from '../../store/index.ts';
import { ContextMenu, Input, type MenuItem } from '../../ui/index.ts';
import { flattenTree, type LayerRow } from './flatten.ts';

/** Every row is this tall, which is what lets the list render only the rows in view. */
export const ROW_HEIGHT = 28;
const OVERSCAN = 6;
/** Used until the list has been measured (and where nothing is laid out, as in tests). */
const FALLBACK_HEIGHT = 400;
const INDENT = 14;

export interface LayersPanelProps {
  /** The component a "Wrap in container" wraps the selection in. */
  readonly wrapperType?: string;
}

/** The nodes that have an issue, from the last validation and accessibility run. */
function useIssueNodes(): ReadonlySet<NodeId> {
  const validation = useEditorState((state) => state.validation);
  return useMemo(() => {
    const ids = new Set<NodeId>();
    if (validation === undefined) return ids;
    for (const issue of validation.issues) {
      const [head, id] = issue.path ?? [];
      const named = issue.details?.['nodeId'];
      if (head === 'nodes' && typeof id === 'string') ids.add(id);
      else if (typeof named === 'string') ids.add(named);
    }
    for (const issue of validation.a11y) ids.add(issue.nodeId);
    return ids;
  }, [validation]);
}

/**
 * The document as a tree (docs/editor.md#layers): a WAI-ARIA tree that is fully operable with the
 * keyboard, virtualized (only the rows in view exist), kept in step with the selection and hover in
 * the store (the canvas and the tree show the same node), with rename, badges and a context menu.
 * Focus stays on the tree and `aria-activedescendant` names the row; the selection follows it.
 */
export function LayersPanel({ wrapperType = 'buildr/box' }: LayersPanelProps) {
  const t = useT();
  const store = useEditor();
  const manifest = useManifest();
  const treeId = useId();
  const doc = useEditorState((state) => state.doc);
  const selectedIds = useEditorState((state) => state.selectedIds);
  const anchorId = useEditorState((state) => state.anchorId);
  const hoveredId = useEditorState((state) => state.hoveredId);
  const readOnly = useEditorState((state) => state.readOnly);
  const issueNodes = useIssueNodes();

  const [expanded, setExpanded] = useState<ReadonlySet<NodeId>>(() => new Set([doc.root]));
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const [menuTarget, setMenuTarget] = useState<NodeId | null>(null);
  const [notice, setNotice] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);
  const scroller = useRef<HTMLDivElement>(null);
  const reveal = useRef<NodeId | null>(null);
  const [moving, setMoving] = useState<readonly NodeId[] | null>(null);
  const press = useDragPress();
  const canDrag = useDragAvailable();
  const drop = useDragState((state) => (state.over === 'tree' ? state.tree : null));
  const dropTarget = useDragState((state) => (state.over === 'tree' ? state.target : null));

  const rows = useMemo(() => flattenTree(doc, expanded), [doc, expanded]);
  useRegisterTree(() => {
    const element = scroller.current;
    if (element === null) return undefined;
    const box = element.getBoundingClientRect();
    return {
      viewport: { left: box.left, top: box.top, width: box.width, height: box.height },
      scrollTop: element.scrollTop,
      rows,
      rowHeight: ROW_HEIGHT,
    };
  });
  useDragAutoscroll(scroller);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row.id, i])), [rows]);

  // --- windowing ---
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const measure = () =>
      setHeight(element.clientHeight > 0 ? element.clientHeight : FALLBACK_HEIGHT);
    measure();
    const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer === undefined) return;
    const observer = new Observer(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const visible = rows.slice(first, last);

  const scrollToIndex = useCallback((index: number) => {
    const element = scroller.current;
    if (element === null) return;
    const top = index * ROW_HEIGHT;
    const view = element.clientHeight > 0 ? element.clientHeight : FALLBACK_HEIGHT;
    let next = element.scrollTop;
    if (top < next) next = top;
    else if (top + ROW_HEIGHT > next + view) next = top + ROW_HEIGHT - view;
    if (next !== element.scrollTop) element.scrollTop = next;
    setScrollTop(next);
  }, []);

  // --- the selection shows in the tree: its ancestors open, and it scrolls into view ---
  // Only a change of the selection reveals; an edit elsewhere must not move the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (anchorId === null) return;
    reveal.current = anchorId;
    const ancestors = pathTo(doc, anchorId).slice(0, -1);
    if (ancestors.some((id) => !expanded.has(id))) {
      setExpanded((current) => new Set([...current, ...ancestors]));
    }
  }, [anchorId]);

  // `anchorId` is here so that a new selection is looked for even when the rows did not change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const id = reveal.current;
    if (id === null) return;
    const index = rowIndex.get(id);
    if (index === undefined) return;
    reveal.current = null;
    scrollToIndex(index);
  }, [rowIndex, scrollToIndex, anchorId]);

  // --- doing things ---
  const run = useCallback(
    (command: Command, label?: string) => {
      const result = store.dispatch(command, label !== undefined ? { label } : undefined);
      setNotice(result.ok ? '' : result.error.message);
    },
    [store],
  );

  const toggle = useCallback((id: NodeId, open?: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const startRename = (id: NodeId) => {
    if (!readOnly && id !== doc.root) setRenaming(id);
  };

  const commitRename = (id: NodeId, text: string) => {
    setRenaming(null);
    scroller.current?.focus();
    const name = text.trim();
    const current = doc.nodes[id]?.name ?? '';
    if (name === current) return;
    run({ type: 'node.setAttr', payload: { id, key: 'name', value: name === '' ? null : name } });
  };

  const removable = (ids: readonly NodeId[]) => ids.filter((id) => id !== doc.root);

  const remove = () => {
    const ids = removable(selectedIds);
    if (ids.length > 0) run({ type: 'node.remove', payload: { ids } });
  };

  // --- keyboard ---
  const activeIndex = anchorId === null ? -1 : (rowIndex.get(anchorId) ?? -1);

  const goTo = (index: number, mode: 'replace' | 'add') => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (row === undefined) return;
    store.select(row.id, { mode });
    scrollToIndex(rowIndex.get(row.id) ?? 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const row = activeIndex >= 0 ? rows[activeIndex] : undefined;
    const mode = event.shiftKey ? 'add' : 'replace';
    let handled = true;
    switch (event.key) {
      case 'ArrowDown':
        goTo(activeIndex + 1, mode);
        break;
      case 'ArrowUp':
        goTo(activeIndex < 0 ? 0 : activeIndex - 1, mode);
        break;
      case 'Home':
        goTo(0, mode);
        break;
      case 'End':
        goTo(rows.length - 1, mode);
        break;
      case 'ArrowRight':
        if (row === undefined) goTo(0, 'replace');
        else if (row.hasChildren && !row.expanded) toggle(row.id, true);
        else if (row.hasChildren) goTo(activeIndex + 1, 'replace');
        break;
      case 'ArrowLeft':
        if (row === undefined) break;
        if (row.expanded) toggle(row.id, false);
        else if (row.parentId !== null) {
          store.select(row.parentId);
          scrollToIndex(rowIndex.get(row.parentId) ?? 0);
        }
        break;
      case 'Enter':
      case ' ':
        if (row !== undefined) store.select(row.id, { mode: 'replace' });
        break;
      case 'F2':
        if (row !== undefined) startRename(row.id);
        break;
      case 'Delete':
      case 'Backspace':
        if (!readOnly) remove();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  // --- pointer ---
  const rowOf = (event: { target: EventTarget | null }): NodeId | undefined => {
    const element = (event.target as Element | null)?.closest?.('[data-node-id]');
    return element?.getAttribute('data-node-id') ?? undefined;
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const id = rowOf(event);
    if (id === undefined) return;
    if ((event.target as Element).closest('[data-toggle]') !== null) return toggle(id);
    const mode = event.shiftKey ? 'add' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
    store.select(id, { mode });
    scroller.current?.focus();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (press === undefined || readOnly || renaming !== null) return;
    const id = rowOf(event);
    if (id === undefined || id === doc.root) return;
    if ((event.target as Element).closest('[data-toggle]') !== null) return;
    const ids = selected.has(id) ? removable(selectedIds) : [id];
    if (ids.length === 0) return;
    const node = doc.nodes[id];
    const label =
      ids.length > 1
        ? `${ids.length} ${t('dnd.ghost.nodes')}`
        : (node?.name ?? componentMeta(manifest, node?.type ?? '')?.label ?? node?.type ?? id);
    press({ kind: 'nodes', ids }, label, event);
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const id = rowOf(event);
    if (id !== undefined && (event.target as Element).closest('[data-toggle]') === null) {
      startRename(id);
    }
  };

  const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    const id = rowOf(event) ?? null;
    if (id !== hoveredId) store.setHovered(id);
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const id = rowOf(event) ?? anchorId;
    if (id === null) return;
    if (!selected.has(id)) store.select(id);
    setMenuTarget(id);
  };

  // --- the menu ---
  // The helpers below only close over `doc`, which is a dependency.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  const menu: MenuItem[] = useMemo(() => {
    const target = menuTarget === null ? undefined : doc.nodes[menuTarget];
    if (target === undefined || menuTarget === null) return [];
    const ids = removable(selectedIds.includes(menuTarget) ? selectedIds : [menuTarget]);
    const isRoot = menuTarget === doc.root;
    const canWrap = componentMeta(manifest, wrapperType) !== undefined;
    const move: MenuItem[] = canDrag
      ? [
          {
            id: 'move',
            label: t('dnd.moveTo'),
            disabled: readOnly || ids.length === 0,
            onSelect: () => setMoving(ids),
          },
        ]
      : [];
    return [
      {
        id: 'rename',
        label: t('layers.menu.rename'),
        disabled: readOnly || isRoot,
        onSelect: () => startRename(menuTarget),
      },
      {
        id: 'duplicate',
        label: t('layers.menu.duplicate'),
        disabled: readOnly || ids.length === 0,
        onSelect: () => run({ type: 'node.duplicate', payload: { ids } }),
      },
      {
        id: 'wrap',
        label: t('layers.menu.wrap'),
        disabled: readOnly || ids.length === 0 || !canWrap,
        onSelect: () =>
          run({ type: 'node.wrap', payload: { ids, wrapper: { type: wrapperType } } }),
      },
      {
        id: 'unwrap',
        label: t('layers.menu.unwrap'),
        disabled: readOnly || isRoot || target.slots === undefined,
        onSelect: () => run({ type: 'node.unwrap', payload: { id: menuTarget } }),
      },
      ...move,
      {
        id: 'delete',
        label: t('layers.menu.delete'),
        danger: true,
        disabled: readOnly || ids.length === 0,
        onSelect: () => run({ type: 'node.remove', payload: { ids } }),
      },
    ];
    // biome-ignore lint/correctness/useExhaustiveDependencies: startRename and removable read the same inputs
  }, [menuTarget, doc, selectedIds, manifest, wrapperType, readOnly, canDrag, t, run]);

  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;
  const rowDomId = (id: NodeId) => `${treeId}-${id}`;

  return (
    <div className="bd-layers">
      <ContextMenu items={menu} label={t('layers.menu')}>
        {/* biome-ignore lint/a11y/useSemanticElements: an ARIA tree has no native element */}
        <div
          ref={scroller}
          role="tree"
          aria-label={t('layers.title')}
          aria-multiselectable="true"
          aria-activedescendant={
            activeRow !== undefined && activeIndex >= first && activeIndex < last
              ? rowDomId(activeRow.id)
              : undefined
          }
          tabIndex={0}
          className="bd-layers-scroll"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onKeyDown={onKeyDown}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
          onPointerOver={onPointerOver}
          onPointerLeave={() => store.setHovered(null)}
          onContextMenu={onContextMenu}
        >
          <div className="bd-layers-list" style={{ height: rows.length * ROW_HEIGHT }}>
            {visible.map((row, i) => (
              <Layer
                key={row.id}
                row={row}
                top={(first + i) * ROW_HEIGHT}
                domId={rowDomId(row.id)}
                selected={selected.has(row.id)}
                hovered={hoveredId === row.id}
                hasIssue={issueNodes.has(row.id)}
                drop={
                  drop !== null && rows[drop.rowIndex]?.id === row.id
                    ? dropTarget === null
                      ? 'denied'
                      : drop.position
                    : undefined
                }
                renaming={renaming === row.id}
                onRename={(text) => commitRename(row.id, text)}
                onCancelRename={() => {
                  setRenaming(null);
                  scroller.current?.focus();
                }}
              />
            ))}
          </div>
        </div>
      </ContextMenu>
      <p className="bd-layers-notice" role="status">
        {notice}
      </p>
      {canDrag ? (
        <MoveToDialog
          open={moving !== null}
          onOpenChange={(open) => {
            if (!open) setMoving(null);
          }}
          ids={moving ?? []}
        />
      ) : null}
    </div>
  );
}

interface LayerProps {
  readonly row: LayerRow;
  readonly top: number;
  readonly domId: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly hasIssue: boolean;
  /** Where a drag in progress would drop relative to this row; `denied` where it may not. */
  readonly drop: 'before' | 'inside' | 'after' | 'denied' | undefined;
  readonly renaming: boolean;
  readonly onRename: (text: string) => void;
  readonly onCancelRename: () => void;
}

function Layer({
  row,
  top,
  domId,
  selected,
  hovered,
  hasIssue,
  drop,
  renaming,
  onRename,
  onCancelRename,
}: LayerProps) {
  const t = useT();
  const manifest = useManifest();
  const { node } = row;
  const meta = componentMeta(manifest, node.type);
  const label = node.name ?? meta?.label ?? node.type;
  const badges: { key: MessageKey; glyph: string }[] = [];
  if (node.lock !== undefined) badges.push({ key: 'layers.badge.lock', glyph: '🔒' });
  if (node.visibleIf !== undefined) badges.push({ key: 'layers.badge.visibleIf', glyph: '◐' });
  const bp = node.styles?.bp;
  if (bp !== undefined && Object.keys(bp).length > 0) {
    badges.push({ key: 'layers.badge.breakpoints', glyph: '▭' });
  }
  if (hasIssue) badges.push({ key: 'layers.badge.issues', glyph: '⚠' });

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the tree (aria-activedescendant)
    // biome-ignore lint/a11y/useSemanticElements: an ARIA tree has no native element
    <div
      role="treeitem"
      id={domId}
      data-node-id={row.id}
      aria-level={row.level}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      className="bd-layer"
      data-selected={selected}
      data-hovered={hovered}
      data-drop={drop}
      style={{
        top,
        height: ROW_HEIGHT,
        paddingLeft: 4 + (row.level - 1) * INDENT,
      }}
    >
      <span className="bd-layer-toggle" data-toggle aria-hidden="true">
        {row.hasChildren ? (row.expanded ? '▾' : '▸') : ''}
      </span>
      <span className="bd-layer-icon" data-icon={meta?.icon} aria-hidden="true">
        {(meta?.label ?? node.type).charAt(0).toUpperCase()}
      </span>
      {renaming ? (
        <RenameField
          initial={node.name ?? ''}
          placeholder={meta?.label ?? node.type}
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className="bd-layer-label">{label}</span>
      )}
      {row.slot !== 'default' ? <span className="bd-layer-slot">{row.slot}</span> : null}
      {badges.map((badge) => (
        <span key={badge.key} className="bd-layer-badge" role="img" aria-label={t(badge.key)}>
          {badge.glyph}
        </span>
      ))}
    </div>
  );
}

interface RenameFieldProps {
  readonly initial: string;
  readonly placeholder: string;
  readonly onCommit: (text: string) => void;
  readonly onCancel: () => void;
}

/** The name field of a layer being renamed: it ends once, whether by Enter, Escape or leaving it. */
function RenameField({ initial, placeholder, onCommit, onCancel }: RenameFieldProps) {
  const t = useT();
  const finished = useRef(false);
  const finish = (end: () => void) => {
    if (finished.current) return;
    finished.current = true;
    end();
  };
  return (
    <Input
      className="bd-layer-rename"
      aria-label={t('layers.rename')}
      defaultValue={initial}
      placeholder={placeholder}
      // biome-ignore lint/a11y/noAutofocus: the field opens because the person asked to rename
      autoFocus
      onKeyDown={(event) => {
        event.stopPropagation();
        const text = event.currentTarget.value;
        if (event.key === 'Enter') finish(() => onCommit(text));
        else if (event.key === 'Escape') finish(onCancel);
      }}
      onBlur={(event) => {
        const text = event.currentTarget.value;
        finish(() => onCommit(text));
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
