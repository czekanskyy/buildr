import type { ComponentMeta, PageNode, PropDef, Value } from '@next-buildr/core';
import { useId, useState } from 'react';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { Icon, IconButton } from '../../ui/index.ts';
import { propLabel, renderControl } from './controls/index.ts';
import { type PropReading, readProp, translationLocale } from './value.ts';
import { TranslationHint } from './values/translation.tsx';
import { ValueEditor } from './values/value-editor.tsx';

/** Groups that live on the Advanced tab; everything else is content. */
const ADVANCED_GROUPS: ReadonlySet<string> = new Set(['advanced', 'accessibility']);

export const isAdvancedProp = (def: PropDef) =>
  def.group !== undefined && ADVANCED_GROUPS.has(def.group);

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export { propLabel };

/** Short controls sit on one row with their label; long ones are stacked under it. */
const ROW_KINDS: ReadonlySet<string> = new Set(['boolean', 'select', 'number', 'icon']);

const storageKey = (type: string) => `buildr.editor.inspector.groups.${type}`;

/** The groups the user closed for a component type (localStorage, best effort). */
function loadClosed(type: string): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(type));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveClosed(type: string, closed: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(storageKey(type), JSON.stringify([...closed]));
  } catch {
    // storage is unavailable: the state just is not remembered
  }
}

/** Which prop groups are collapsed, remembered per component type. */
function useClosedGroups(type: string) {
  const [state, setState] = useState(() => ({ type, closed: loadClosed(type) }));
  let closed = state.closed;
  if (state.type !== type) {
    closed = loadClosed(type);
    setState({ type, closed });
  }
  const toggle = (group: string) => {
    const next = new Set(closed);
    if (!next.delete(group)) next.add(group);
    saveClosed(type, next);
    setState({ type, closed: next });
  };
  return { closed, toggle };
}

export interface PropsPanelProps {
  readonly node: PageNode;
  readonly meta: ComponentMeta;
  /** Which props to show: the content ones or the advanced ones. */
  readonly scope: 'content' | 'advanced';
  readonly locale: string | undefined;
  readonly defaultLocale: string | undefined;
  readonly disabled: boolean;
  readonly onChange: (prop: string, def: PropDef, value: unknown) => void;
  readonly onReset: (prop: string, def: PropDef) => void;
  /** Writes a binding or a formula (PB-081). */
  readonly onSetValue?: (prop: string, def: PropDef, value: Value) => void;
  /** Back from a binding or a formula to a fixed value. */
  readonly onFixed?: (prop: string, def: PropDef) => void;
}

/** A hint shown under a control: what the default is, and the limits a value must keep. */
function hintFor(def: PropDef, t: (key: MessageKey) => string): string {
  const parts: string[] = [];
  const shown = String(def.default);
  if (def.kind !== 'list' && def.kind !== 'object' && def.kind !== 'richText' && shown !== '') {
    parts.push(`${t('inspector.default')}: ${shown}`);
  }
  if ((def.kind === 'text' || def.kind === 'textarea') && def.maxLength !== undefined) {
    parts.push(`${t('inspector.maxLength')}: ${def.maxLength}`);
  }
  if (def.kind === 'number') {
    if (def.min !== undefined) parts.push(`${t('inspector.min')}: ${def.min}`);
    if (def.max !== undefined) parts.push(`${t('inspector.max')}: ${def.max}`);
  }
  return parts.join(' · ');
}

function Field(props: {
  readonly name: string;
  readonly def: PropDef;
  readonly reading: PropReading;
  readonly raw: Value | undefined;
  readonly disabled: boolean;
  readonly translating: boolean;
  readonly onChange: PropsPanelProps['onChange'];
  readonly onReset: PropsPanelProps['onReset'];
  readonly onSetValue: PropsPanelProps['onSetValue'];
  readonly onFixed: PropsPanelProps['onFixed'];
}) {
  const { name, def, reading, disabled, translating } = props;
  const t = useT();
  const id = useId();
  const hintId = `${id}-hint`;
  const label = propLabel(name, def);
  const hint = hintFor(def, t);
  const editable = reading.mode === 'static';
  const control = renderControl(def, {
    id,
    def,
    label,
    describedBy: hint === '' ? undefined : hintId,
    value: reading.value,
    disabled,
    onChange: (value) => props.onChange(name, def, value),
  });
  const layout = ROW_KINDS.has(def.kind) ? 'row' : 'stack';

  return (
    <div
      className="bd-field"
      data-prop={name}
      data-kind={def.kind}
      data-layout={layout}
      data-untranslated={translating && !reading.isSet ? true : undefined}
    >
      <div className="bd-field-head">
        {control !== null && editable ? (
          <label htmlFor={id} className="bd-field-label">
            {label}
            {translating ? (
              <span className="bd-field-locale"> ({t('inspector.translation')})</span>
            ) : null}
          </label>
        ) : (
          <span className="bd-field-label">{label}</span>
        )}
        {reading.isSet ? (
          <IconButton
            variant="ghost"
            icon="rotate-ccw"
            className="bd-field-reset"
            disabled={disabled}
            label={`${t(translating ? 'translation.remove' : 'inspector.reset')}: ${label}`}
            onClick={() => props.onReset(name, def)}
          />
        ) : null}
      </div>
      <div className="bd-field-body">
        <ValueEditor
          def={def}
          label={label}
          raw={props.raw}
          disabled={disabled}
          staticControl={control}
          onSet={(value) => props.onSetValue?.(name, def, value)}
          onFixed={() => props.onFixed?.(name, def)}
        />
      </div>
      {translating && editable ? (
        <TranslationHint
          translated={reading.isSet}
          disabled={disabled}
          label={label}
          onTranslate={() => props.onChange(name, def, reading.value)}
        />
      ) : null}
      {editable && control === null ? (
        <p className="bd-field-unsupported">{t('inspector.unsupported')}</p>
      ) : null}
      {hint !== '' ? (
        <p className="bd-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The props of a component as controls, grouped by their `group` (docs/editor.md#inspector). A
 * control writes with `node.setProp` (typing coalesces into one undo step through the command's
 * merge key) and "Reset" removes the value (`node.unsetProp`), which shows the default again.
 */
export function PropsPanel(props: PropsPanelProps) {
  const t = useT();
  const { node, meta, scope, locale, defaultLocale } = props;
  const { closed, toggle } = useClosedGroups(node.type);
  const panelId = useId();
  const entries = Object.entries(meta.props).filter(
    ([, def]) => isAdvancedProp(def) === (scope === 'advanced'),
  );
  if (entries.length === 0) {
    return scope === 'content' ? (
      <div className="bd-inspector-empty" data-state="no-props">
        <Icon name="box" size="md" />
        <p className="bd-inspector-empty-title">{t('inspector.noProps')}</p>
      </div>
    ) : null;
  }
  const groups = new Map<string, [string, PropDef][]>();
  for (const entry of entries) {
    const group = entry[1].group ?? '';
    const list = groups.get(group);
    if (list === undefined) groups.set(group, [entry]);
    else list.push(entry);
  }
  return (
    <div className="bd-props">
      {[...groups].map(([group, list]) => (
        <section key={group} className="bd-props-group" data-group={group}>
          {group !== '' ? (
            <h4 className="bd-props-heading">
              <button
                type="button"
                className="bd-props-toggle"
                aria-expanded={!closed.has(group)}
                aria-controls={`${panelId}-${group}`}
                onClick={() => toggle(group)}
              >
                <Icon name={closed.has(group) ? 'chevron-right' : 'chevron-down'} />
                {titleCase(group)}
              </button>
            </h4>
          ) : null}
          <div id={`${panelId}-${group}`} className="bd-props-fields" hidden={closed.has(group)}>
            {list.map(([name, def]) => (
              <Field
                key={name}
                name={name}
                def={def}
                reading={readProp(node, name, def, locale, defaultLocale)}
                raw={
                  node.props !== undefined && Object.hasOwn(node.props, name)
                    ? node.props[name]
                    : undefined
                }
                disabled={props.disabled}
                translating={translationLocale(def, locale, defaultLocale) !== undefined}
                onChange={props.onChange}
                onReset={props.onReset}
                onSetValue={props.onSetValue}
                onFixed={props.onFixed}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
