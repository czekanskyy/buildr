import type { ComponentMeta, PageNode, PropDef, Value } from '@next-buildr/core';
import { useId, useState } from 'react';
import { componentMeta, useSourceManifest } from '../../app/manifest.tsx';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { useEditor } from '../../store/index.ts';
import { Icon, IconButton, SegmentedControl } from '../../ui/index.ts';
import { ExternalUrlControl, propLabel, renderControl } from './controls/index.ts';
import { parseNumber } from './controls/number.tsx';
import { formatDefault } from './default-hint.ts';
import { ScrubLabel } from './scrub-label.tsx';
import { type PropReading, readProp, translationLocale } from './value.ts';
import { TranslationHint } from './values/translation.tsx';
import { ValueEditor } from './values/value-editor.tsx';

/** Groups that live on the Advanced tab; everything else is content. */
const ADVANCED_GROUPS: ReadonlySet<string> = new Set(['advanced', 'accessibility']);

export const isAdvancedProp = (def: PropDef) =>
  def.group !== undefined && ADVANCED_GROUPS.has(def.group);

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export { propLabel };

const TEXT_MODES = ['plain', 'rich', 'html'] as const;

/**
 * The group a prop is shown in. The background props of a container carry no `group`; they are
 * collected under "Background" by their names (`background*` and `overlay*`), so the editor needs
 * no knowledge of the component.
 */
export function propGroup(name: string, def: PropDef): string {
  if (def.group !== undefined) return def.group;
  return /^(background|overlay)[A-Z]/.test(name) ? 'background' : '';
}

/** Short selects that read better as a row of segments (media fit, scrolling and overlay tone). */
const SEGMENTED_SELECTS: ReadonlySet<string> = new Set([
  'backgroundFit',
  'backgroundAttachment',
  'overlayTone',
]);

/** A text prop that always holds an address outside the site (the iframe's `url`, ADR-028). */
export const isExternalUrlProp = (type: string, name: string, def: PropDef): boolean =>
  type === 'buildr/iframe' && name === 'url' && def.kind === 'text';

/**
 * Text has three ways to write its content (ADR-026): `mode` picks one of `text`, `rich` and
 * `html`. The inspector shows the mode as a switch and only the field of the chosen mode. Found by
 * the shape of the props, so the editor needs no knowledge of the component.
 */
export function hasTextModes(props: Readonly<Record<string, PropDef>>): boolean {
  const mode = props['mode'];
  return (
    mode?.kind === 'select' &&
    TEXT_MODES.every((value) => (mode.options as readonly unknown[]).includes(value)) &&
    props['text'] !== undefined &&
    props['rich']?.kind === 'richText' &&
    props['html']?.kind === 'textarea'
  );
}

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
  /** Lower-case text the labels must contain (the inspector search); empty shows everything. */
  readonly query?: string;
  /** Other fields on the same tab already match the query: no "no match" message. */
  readonly othersMatch?: boolean;
  readonly onChange: (prop: string, def: PropDef, value: unknown) => void;
  readonly onReset: (prop: string, def: PropDef) => void;
  /** Writes a binding or a formula (PB-081). */
  readonly onSetValue?: (prop: string, def: PropDef, value: Value) => void;
  /** Back from a binding or a formula to a fixed value. */
  readonly onFixed?: (prop: string, def: PropDef) => void;
}

/** A hint shown under a control: what the default is, and the limits a value must keep. */
function hintFor(
  def: PropDef,
  t: (key: MessageKey) => string,
  /** The component's label when the default text is the component's own English name. */
  nameFor: (text: string) => string,
): string {
  const parts: string[] = [];
  const shown = formatDefault(def, t, nameFor);
  if (shown !== undefined) parts.push(`${t('inspector.default')}: ${shown}`);
  if ((def.kind === 'text' || def.kind === 'textarea') && def.maxLength !== undefined) {
    parts.push(`${t('inspector.maxLength')}: ${def.maxLength}`);
  }
  if (def.kind === 'number') {
    if (def.min !== undefined) parts.push(`${t('inspector.min')}: ${def.min}`);
    if (def.max !== undefined) parts.push(`${t('inspector.max')}: ${def.max}`);
  }
  return parts.join(' · ');
}

export function Field(props: {
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
  readonly nameFor: (text: string) => string;
  /** The `mode` prop of a text with three modes: drawn as a switch. */
  readonly textMode?: boolean;
  /** The prop is an external address: it is added through the ADR-028 warning. */
  readonly externalUrl?: boolean;
}) {
  const { name, def, reading, disabled, translating } = props;
  const t = useT();
  const id = useId();
  const authorCode = useEditor().authorCode;
  const hintId = `${id}-hint`;
  const label =
    props.textMode === true
      ? t('inspector.text.mode')
      : name === 'level'
        ? t('inspector.content.level')
        : propLabel(name, def);
  const hint = props.textMode === true ? '' : hintFor(def, t, props.nameFor);
  const editable = reading.mode === 'static';
  const current = String(reading.value);
  const control =
    props.textMode === true ? (
      <SegmentedControl
        label={t('inspector.text.mode')}
        value={current}
        disabled={disabled}
        options={TEXT_MODES.map((value) => ({
          value,
          label: t(`inspector.text.mode.${value}` as MessageKey),
          disabled: value === 'html' && !authorCode && current !== 'html',
        }))}
        onValueChange={(value) => props.onChange(name, def, value)}
      />
    ) : name === 'level' &&
      def.kind === 'select' &&
      def.options.every((value) => typeof value === 'number' && value >= 1 && value <= 6) ? (
      <SegmentedControl
        label={t('inspector.content.level')}
        value={String(reading.value)}
        disabled={disabled}
        options={def.options.map((value) => ({ value: String(value), label: `H${value}` }))}
        onValueChange={(value) => props.onChange(name, def, Number(value))}
      />
    ) : props.externalUrl === true ? (
      <ExternalUrlControl
        id={id}
        label={label}
        describedBy={hint === '' ? undefined : hintId}
        value={reading.value}
        disabled={disabled}
        onChange={(value) => props.onChange(name, def, value)}
      />
    ) : SEGMENTED_SELECTS.has(name) && def.kind === 'select' && def.options.length <= 3 ? (
      <SegmentedControl
        label={label}
        value={String(reading.value)}
        disabled={disabled}
        options={def.options.map((option) => ({
          value: String(option),
          label: def.optionLabels?.[String(option)] ?? String(option),
        }))}
        onValueChange={(chosen) => {
          const option = def.options.find((candidate) => String(candidate) === chosen);
          if (option !== undefined) props.onChange(name, def, option);
        }}
      />
    ) : (
      renderControl(def, {
        id,
        def,
        label,
        describedBy: hint === '' ? undefined : hintId,
        value: reading.value,
        disabled,
        onChange: (value) => props.onChange(name, def, value),
      })
    );
  const layout = ROW_KINDS.has(def.kind) && !SEGMENTED_SELECTS.has(name) ? 'row' : 'stack';

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
          def.kind === 'number' ? (
            <ScrubLabel
              htmlFor={id}
              value={String(reading.value ?? def.default)}
              step={def.step ?? 1}
              min={def.min}
              max={def.max}
              disabled={disabled}
              onValueChange={(text) => {
                const next = parseNumber(text, def);
                if (next !== undefined) props.onChange(name, def, next);
              }}
            >
              {label}
              {translating ? (
                <span className="bd-field-locale"> ({t('inspector.translation')})</span>
              ) : null}
            </ScrubLabel>
          ) : (
            <label htmlFor={id} className="bd-field-label">
              {label}
              {translating ? (
                <span className="bd-field-locale"> ({t('inspector.translation')})</span>
              ) : null}
            </label>
          )
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
  const source = componentMeta(useSourceManifest(), node.type);
  const { closed, toggle } = useClosedGroups(node.type);
  const panelId = useId();
  const query = props.query ?? '';
  const all = Object.entries(meta.props).filter(
    ([, def]) => isAdvancedProp(def) === (scope === 'advanced'),
  );
  all.sort(([a], [b]) => Number(b === 'level') - Number(a === 'level'));
  const modal = hasTextModes(meta.props);
  const modeDef = meta.props['mode'];
  const modeValue =
    modal && modeDef !== undefined
      ? readProp(node, 'mode', modeDef, locale, defaultLocale).value
      : undefined;
  const activeMode = typeof modeValue === 'string' ? modeValue : 'plain';
  // Only the field of the chosen text mode is shown (plain: text, rich: rich, html: html).
  const inMode = (name: string) =>
    !modal ||
    !['text', 'rich', 'html'].includes(name) ||
    (name === 'text' ? 'plain' : name) === activeMode;
  const entries = all.filter(
    ([name, def]) =>
      inMode(name) && (query === '' || propLabel(name, def).toLowerCase().includes(query)),
  );
  if (entries.length === 0 && all.length > 0) {
    if (props.othersMatch === true) return null;
    return (
      <p className="bd-inspector-empty" data-state="no-match">
        {t('inspector.search.noMatch').replace('{query}', query)}
      </p>
    );
  }
  if (entries.length === 0) {
    return scope === 'content' ? (
      <div className="bd-inspector-empty" data-state="no-props">
        <Icon name="box" size="md" />
        <p className="bd-inspector-empty-title">{t('inspector.noProps')}</p>
      </div>
    ) : null;
  }
  // A default text that is the component's English name ("Heading") reads as its label in the UI language.
  const nameFor = (text: string) =>
    source?.label !== undefined && text === source.label ? (meta.label ?? text) : text;
  const groups = new Map<string, [string, PropDef][]>();
  for (const entry of entries) {
    const group = propGroup(entry[0], entry[1]);
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
                {group === 'background' ? t('inspector.group.background') : titleCase(group)}
              </button>
            </h4>
          ) : null}
          <div
            id={`${panelId}-${group}`}
            className="bd-props-fields"
            hidden={closed.has(group) && query === ''}
          >
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
                nameFor={nameFor}
                textMode={modal && name === 'mode'}
                externalUrl={isExternalUrlProp(node.type, name, def)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
