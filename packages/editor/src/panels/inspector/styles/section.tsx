import { type ReactNode, useEffect, useId, useState } from 'react';
import { z } from 'zod';
import type { IconName } from '../../../ui/icon.tsx';
import { Icon } from '../../../ui/index.ts';

const stateSchema = z.record(z.string(), z.boolean());
const storageKey = 'buildr.editor.inspector.styles';
const sectionIcons: Readonly<Record<string, IconName>> = {
  layout: 'layout-grid',
  size: 'stretch-vertical',
  spacing: 'box',
  typography: 'type',
  colors: 'circle',
  background: 'image',
  border: 'braces',
  effects: 'sigma',
  shadow: 'copy',
  visibility: 'eye',
};

function readSections(): Record<string, boolean> {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Preferences stay outside the document and survive node selection, tabs and reloads. */
export function StyleSection(props: {
  readonly name: string;
  readonly label: string;
  readonly defaultOpen: boolean;
  readonly searching: boolean;
  readonly modified: boolean;
  readonly override: boolean;
  readonly children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(
    () => props.modified || (readSections()[props.name] ?? props.defaultOpen),
  );
  useEffect(() => {
    if (props.modified) setOpen(true);
  }, [props.modified]);
  const expanded = props.searching || open;
  return (
    <section className="bd-style-group" data-group={props.name} data-override={props.override}>
      <h4 className="bd-props-heading">
        <button
          type="button"
          className="bd-props-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            const next = !open;
            setOpen(next);
            try {
              localStorage.setItem(
                storageKey,
                JSON.stringify({ ...readSections(), [props.name]: next }),
              );
            } catch {
              // Private browsing and full storage still allow in-memory preferences.
            }
          }}
        >
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
          <Icon name={sectionIcons[props.name] ?? 'braces'} />
          <span>{props.label}</span>
          {props.modified ? <span className="bd-section-modified" aria-hidden="true" /> : null}
        </button>
      </h4>
      <div id={id} className="bd-style-group-body" hidden={!expanded}>
        {props.children}
      </div>
    </section>
  );
}
