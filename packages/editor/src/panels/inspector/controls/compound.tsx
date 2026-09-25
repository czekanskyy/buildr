import type { ListPropDef, ObjectPropDef, PropDef } from '@buildr/core';
import type { ReactNode } from 'react';
import { useT } from '../../../messages/index.tsx';
import { Button, Icon } from '../../../ui/index.ts';
import { BooleanControl } from './boolean.tsx';
import { IconControl } from './icon.tsx';
import { propLabel } from './label.ts';
import { LinkControl } from './link.tsx';
import { MediaControl } from './media.tsx';
import { NumberControl } from './number.tsx';
import { RichTextControl } from './rich-text.tsx';
import { SelectControl } from './select.tsx';
import { TextControl } from './text.tsx';
import { TextareaControl } from './textarea.tsx';
import type { ControlProps } from './types.ts';

/** The control for a prop of any kind, or `null` for a kind that has none. Lists and objects recurse. */
export function renderControl(def: PropDef, common: ControlProps): ReactNode {
  switch (def.kind) {
    case 'text':
      return <TextControl {...common} def={def} />;
    case 'textarea':
      return <TextareaControl {...common} def={def} />;
    case 'number':
      return <NumberControl {...common} def={def} />;
    case 'boolean':
      return <BooleanControl {...common} def={def} />;
    case 'select':
      return <SelectControl {...common} def={def} />;
    case 'link':
      return <LinkControl {...common} def={def} />;
    case 'icon':
      return <IconControl {...common} def={def} />;
    case 'media':
      return <MediaControl {...common} def={def} />;
    case 'richText':
      return <RichTextControl {...common} def={def} />;
    case 'list':
      return <ListControl {...common} def={def} />;
    case 'object':
      return <ObjectControl {...common} def={def} />;
    default:
      return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What an item holds when a fresh one is added: the item definition's default, copied. */
const freshItem = (def: PropDef): unknown => structuredClone(def.default);

/** Moves the item at `from` to `to`; out of range returns the list unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * A list of sub-props: each item is edited with the control of `def.of`, and items can be added
 * (up to `max`), removed (down to `min`) and reordered. Every change writes the whole new list.
 */
export function ListControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<ListPropDef>) {
  const t = useT();
  const items: readonly unknown[] = Array.isArray(value) ? value : [];
  const of = def.of as PropDef;
  const canAdd = def.max === undefined || items.length < def.max;
  const canRemove = def.min === undefined || items.length > def.min;
  const replace = (index: number, item: unknown) =>
    onChange(items.map((current, at) => (at === index ? item : current)));

  return (
    <fieldset className="bd-list" id={id} aria-label={label} aria-describedby={describedBy}>
      {items.length === 0 ? <p className="bd-list-empty">{t('list.empty')}</p> : null}
      <ol className="bd-list-items">
        {items.map((item, index) => {
          const number = index + 1;
          const itemLabel = `${t('list.item')} ${number}`;
          return (
            // The list is positional (no item has an identity of its own), so the index is the key.
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no stable identity
            <li key={index} className="bd-list-item">
              <div className="bd-list-item-head">
                <span className="bd-list-item-title">{itemLabel}</span>
                <span className="bd-list-item-actions">
                  <Button
                    variant="ghost"
                    disabled={disabled || index === 0}
                    aria-label={`${t('list.moveUp')}: ${itemLabel}`}
                    onClick={() => onChange(moveItem(items, index, index - 1))}
                  >
                    <Icon name="arrow-up" />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={disabled || index === items.length - 1}
                    aria-label={`${t('list.moveDown')}: ${itemLabel}`}
                    onClick={() => onChange(moveItem(items, index, index + 1))}
                  >
                    <Icon name="arrow-down" />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={disabled || !canRemove}
                    aria-label={`${t('list.remove')}: ${itemLabel}`}
                    onClick={() => onChange(items.filter((_, at) => at !== index))}
                  >
                    <Icon name="x" />
                  </Button>
                </span>
              </div>
              <div className="bd-list-item-body">
                {renderControl(of, {
                  id: `${id}-${index}`,
                  def: of,
                  label: itemLabel,
                  describedBy: undefined,
                  value: item,
                  disabled,
                  onChange: (next) => replace(index, next),
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        variant="default"
        disabled={disabled || !canAdd}
        onClick={() => onChange([...items, freshItem(of)])}
      >
        {t('list.add')}
      </Button>
    </fieldset>
  );
}

/** A group of named sub-props, each edited with its own control; a change writes the whole object. */
export function ObjectControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<ObjectPropDef>) {
  const shown = isRecord(value) ? value : {};
  const fields = Object.entries(def.fields as Record<string, PropDef>);
  return (
    <fieldset className="bd-object" id={id} aria-label={label} aria-describedby={describedBy}>
      {fields.map(([name, field]) => {
        const fieldId = `${id}-${name}`;
        const fieldLabel = propLabel(name, field);
        const own = Object.hasOwn(shown, name) ? shown[name] : field.default;
        const control = renderControl(field, {
          id: fieldId,
          def: field,
          label: fieldLabel,
          describedBy: undefined,
          value: own,
          disabled,
          onChange: (next) => onChange({ ...shown, [name]: next }),
        });
        return (
          <div key={name} className="bd-object-field" data-field={name} data-kind={field.kind}>
            <label htmlFor={fieldId} className="bd-field-label">
              {fieldLabel}
            </label>
            {control}
          </div>
        );
      })}
    </fieldset>
  );
}
