import { useMemo } from 'react';
import { useT } from '../../messages/index.tsx';
import { pathTo, useEditor, useEditorState } from '../../store/index.ts';

/** `buildr/section` reads as `section`: the namespace says nothing to the author. */
const shortType = (type: string): string => type.slice(type.indexOf('/') + 1);

/**
 * The path from the root to the selected node, each step a button that selects it. Hovering a step
 * highlights that node on the canvas (through the store's `hoveredId`).
 */
export function Breadcrumbs() {
  const t = useT();
  const store = useEditor();
  const doc = useEditorState((state) => state.doc);
  const anchorId = useEditorState((state) => state.anchorId);
  const path = useMemo(() => (anchorId === null ? [] : pathTo(doc, anchorId)), [doc, anchorId]);
  if (path.length === 0) return null;

  return (
    <nav className="bd-breadcrumbs" aria-label={t('editor.breadcrumbs')}>
      <ol>
        {path.map((id) => {
          const node = doc.nodes[id];
          const current = id === anchorId;
          return (
            <li key={id}>
              <button
                type="button"
                className="bd-breadcrumb"
                aria-current={current ? 'location' : undefined}
                onClick={() => store.select(id)}
                onPointerEnter={() => store.setHovered(id)}
                onPointerLeave={() => store.setHovered(null)}
                onFocus={() => store.setHovered(id)}
                onBlur={() => store.setHovered(null)}
              >
                {node?.name ?? (node === undefined ? id : shortType(node.type))}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
