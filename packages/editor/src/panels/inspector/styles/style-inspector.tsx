import {
  canEdit,
  createIndex,
  defaultTheme,
  type EffectiveStyles,
  effectiveStyles,
  getStyleProperty,
  type PageNode,
  propertiesOfGroup,
  STYLE_GROUPS,
  type StyleGroup,
  type StylePropertyDef,
  type Theme,
} from '@next-buildr/core';
import { type ReactNode, useId, useState } from 'react';
import { componentMeta, useManifest } from '../../../app/manifest.tsx';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { useEditor, useEditorState } from '../../../store/index.ts';
import {
  ColorInput,
  IconButton,
  Input,
  NumberUnitInput,
  SegmentedControl,
  Tooltip,
} from '../../../ui/index.ts';
import {
  colorOf,
  isEnumeration,
  isNumeric,
  keywordsOf,
  layerFor,
  partsOf,
  sliderOf,
  stepOf,
  takesNumber,
  unitsOf,
} from './model.ts';
import { PAIRS, SEGMENTED } from './segments.ts';
import { SidesEditor, type SideWrite } from './sides-editor.tsx';
import { TokenPicker } from './token-picker.tsx';
import { useStyleValue } from './use-style-value.ts';

export interface StyleInspectorProps {
  readonly node: PageNode;
  /** The breakpoint being edited: `'base'` (desktop, the default) or a breakpoint id of the theme. */
  readonly breakpoint?: string;
  readonly theme?: Theme;
}

const pathOf = (def: StylePropertyDef, part?: string) =>
  `${def.group}.${def.name}${part !== undefined ? `.${part}` : ''}`;

const humanize = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

/** Where a property's value comes from at the breakpoint being edited. */
type Origin = 'set' | 'inherited' | 'default';

/** The dot beside a property: set on this breakpoint, inherited from a wider one, or the default. */
function SourceDot(props: { readonly origin: Origin; readonly from: string | undefined }) {
  const t = useT();
  const text =
    props.origin === 'set'
      ? t('style.origin.set')
      : props.origin === 'inherited'
        ? `${t('style.origin.inherited')} ${props.from ?? ''}`.trim()
        : t('style.origin.default');
  return (
    <Tooltip content={text}>
      <span className="bd-source-dot" data-origin={props.origin} role="img" aria-label={text} />
    </Tooltip>
  );
}

/** One field for a single value (a whole property). */
function ValueField(props: {
  readonly def: StylePropertyDef;
  readonly path: string;
  readonly label: string;
  /** Id of the input, when the caller draws the label itself. */
  readonly inputId?: string;
  readonly hideLabel?: boolean;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly keywords: readonly string[];
  readonly onSet: (value: string | number) => void;
  readonly onUnset: () => void;
}) {
  const t = useT();
  const ownId = useId();
  const id = props.inputId ?? ownId;
  const { def, path } = props;
  const field = useStyleValue({
    def,
    path,
    effective: props.effective,
    layer: props.layer,
    theme: props.theme,
    onSet: props.onSet,
    onUnset: props.onUnset,
  });
  const { current, shown, error } = field;
  const ariaLabel =
    props.hideLabel === true && props.inputId === undefined ? props.label : undefined;
  const describedBy = error !== '' ? `${id}-error` : undefined;
  const listId = props.keywords.length > 0 ? `${id}-list` : undefined;
  const swatch = colorOf(def, shown.trim(), props.theme);
  const slider = sliderOf(def);

  return (
    <div className="bd-style-value" data-path={path} data-source={current?.source ?? 'none'}>
      {props.hideLabel === true ? null : (
        <label htmlFor={id} className="bd-field-label">
          {props.label}
        </label>
      )}
      <div className="bd-style-input">
        {def.grammar.kind === 'color' ? (
          <ColorInput
            color={swatch}
            label={`${props.label}: ${t('style.colorPicker')}`}
            disabled={props.disabled}
            onColorChange={field.change}
          />
        ) : null}
        {isNumeric(def) ? (
          <NumberUnitInput
            id={id}
            value={shown}
            units={unitsOf(def)}
            unitLabel={`${t('style.unit')}: ${props.label}`}
            step={stepOf(def)}
            bareNumber={takesNumber(def)}
            disabled={props.disabled}
            invalid={error !== ''}
            describedBy={describedBy}
            ariaLabel={ariaLabel}
            list={listId}
            onValueChange={field.change}
            onBlur={field.blur}
          />
        ) : (
          <Input
            id={id}
            value={shown}
            disabled={props.disabled}
            list={listId}
            aria-invalid={error !== ''}
            aria-describedby={describedBy}
            aria-label={ariaLabel}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => field.change(event.target.value)}
            onBlur={field.blur}
          />
        )}
        <TokenPicker
          def={def}
          theme={props.theme}
          label={props.label}
          current={current !== undefined ? String(current.value) : undefined}
          disabled={props.disabled}
          onPick={field.pick}
        />
      </div>
      {slider !== undefined ? (
        <input
          type="range"
          className="bd-range"
          aria-label={`${props.label}: ${t('style.slider')}`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={
            Number.isFinite(Number(field.stored)) && field.stored !== ''
              ? Number(field.stored)
              : slider.max
          }
          disabled={props.disabled}
          onChange={(event) => field.change(event.target.value)}
        />
      ) : null}
      {listId !== undefined ? (
        <datalist id={listId}>
          {props.keywords.map((keyword) => (
            <option key={keyword} value={keyword} />
          ))}
        </datalist>
      ) : null}
      {field.inherited && current !== undefined ? (
        <span className="bd-style-source">{`${t('style.from')} ${current.source === 'base' ? t('style.desktop') : current.source}`}</span>
      ) : null}
      {error !== '' ? (
        <p id={`${id}-error`} role="alert" className="bd-style-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StyleProperty(props: {
  readonly nodeId: string;
  readonly def: StylePropertyDef;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
  /** Draws the sides as a ring around this box (margin around padding). */
  readonly ring?: boolean;
  /** Label on the left, control on the right (Elementor style) instead of one above the other. */
  readonly inline?: boolean;
  /** What sits inside the ring. */
  readonly children?: ReactNode;
}) {
  const t = useT();
  const store = useEditor();
  const { def, nodeId, effective, layer } = props;
  const id = useId();
  const label = def.group === 'border' && def.name === 'width' ? 'Border' : humanize(def.name);
  const parts = partsOf(def);
  const layerObject = layerFor(layer);

  const setOne = (value: string | number | boolean, part?: string) =>
    store.dispatch({
      type: 'node.setStyle',
      payload: {
        id: nodeId,
        layer: layerObject,
        group: def.group,
        property: def.name,
        ...(part !== undefined ? { side: part } : {}),
        value,
      },
    });
  const unsetOne = (part?: string) =>
    store.dispatch({
      type: 'node.unsetStyle',
      payload: {
        id: nodeId,
        layer: layerObject,
        group: def.group,
        property: def.name,
        ...(part !== undefined ? { side: part } : {}),
      },
    });
  type Result = ReturnType<typeof setOne>;
  const report = (result: Result) => props.onError(result.ok ? '' : (result.error?.message ?? ''));
  /** Several sides at once (linked sides) are one undo step. */
  const apply = (writes: readonly SideWrite[]) => {
    const run = (write: SideWrite): Result =>
      write.value === undefined ? unsetOne(write.part) : setOne(write.value, write.part);
    if (writes.length === 1) return report(run(writes[0] as SideWrite));
    let failure = '';
    store.transaction(label, () => {
      for (const write of writes) {
        const result = run(write);
        if (!result.ok) failure ||= result.error?.message ?? '';
      }
      return failure === '';
    });
    props.onError(failure);
  };
  const set = (value: string | number | boolean, part?: string) => report(setOne(value, part));
  const unset = (part?: string) => report(unsetOne(part));

  const paths = parts.length > 0 ? parts.map((part) => pathOf(def, part)) : [pathOf(def)];
  const here = paths.some((path) => effective[path]?.source === layer);
  const known = paths.map((path) => effective[path]).filter((entry) => entry !== undefined);
  const origin: Origin = here ? 'set' : known.length > 0 ? 'inherited' : 'default';
  const from = known[0]?.source === 'base' ? t('style.desktop') : known[0]?.source;
  const base = { def, effective, layer, theme: props.theme, disabled: props.disabled };
  const keywords = keywordsOf(def);
  const key = pathOf(def);

  const head = (control: ReactNode, extras?: ReactNode) => (
    <div className="bd-style-head">
      {control}
      {extras}
      <SourceDot origin={origin} from={from} />
      {here ? (
        <IconButton
          icon="rotate-ccw"
          className="bd-field-reset"
          disabled={props.disabled}
          label={`${t('inspector.reset')}: ${label}`}
          onClick={() =>
            parts.length > 0
              ? apply(
                  parts
                    .filter((part) => effective[pathOf(def, part)]?.source === layer)
                    .map((part) => ({ part, value: undefined })),
                )
              : unset()
          }
        />
      ) : null}
    </div>
  );

  if (def.grammar.kind === 'boolean') {
    const value = effective[key];
    return (
      <div className="bd-field bd-style-field" data-style-prop={key} data-origin={origin}>
        {head(
          <label className="bd-style-check">
            <input
              type="checkbox"
              checked={value?.value === true}
              disabled={props.disabled}
              onChange={(event) => (event.target.checked ? set(true) : unset())}
            />
            {label}
          </label>,
        )}
      </div>
    );
  }

  if (parts.length > 0) {
    return (
      <div
        className={props.ring === true ? 'bd-style-field bd-style-ring' : 'bd-field bd-style-field'}
        data-style-prop={key}
        data-origin={origin}
      >
        <SidesEditor
          {...base}
          label={label}
          parts={parts}
          layout={props.ring === true ? 'ring' : 'row'}
          apply={apply}
          renderHead={(extras) => head(<span className="bd-field-label">{label}</span>, extras)}
        >
          {props.children}
        </SidesEditor>
      </div>
    );
  }

  let title: ReactNode = <span className="bd-field-label">{label}</span>;
  let body: ReactNode;
  if (isEnumeration(def)) {
    const current = effective[key];
    const segments = SEGMENTED[key]?.filter((segment) => keywords.includes(segment.keyword));
    const currentText = current !== undefined ? String(current.value) : undefined;
    const currentLabel =
      current !== undefined
        ? `${String(current.value)} (${current.source === 'base' ? t('style.desktop') : current.source})`
        : '—';
    const remaining =
      segments === undefined
        ? keywords
        : keywords.filter((keyword) => !segments.some((segment) => segment.keyword === keyword));
    body = (
      <div className="bd-style-enum" data-segmented={segments !== undefined ? '' : undefined}>
        {segments !== undefined ? (
          <SegmentedControl
            label={label}
            value={currentText}
            disabled={props.disabled}
            options={segments.map((segment) => ({
              value: segment.keyword,
              label: segment.keyword,
              ...(segment.icon !== undefined ? { icon: segment.icon } : {}),
              iconOnly: segment.icon !== undefined,
            }))}
            onValueChange={(keyword) =>
              current?.source === layer && currentText === keyword ? unset() : set(keyword)
            }
          />
        ) : null}
        {remaining.length > 0 ? (
          <select
            id={id}
            className="bd-input"
            aria-label={segments !== undefined ? `${label}: ${t('style.more')}` : undefined}
            value={
              current?.source === layer && remaining.includes(String(current.value))
                ? String(current.value)
                : ''
            }
            disabled={props.disabled}
            onChange={(event) => (event.target.value === '' ? unset() : set(event.target.value))}
          >
            <option value="">{segments !== undefined ? '—' : currentLabel}</option>
            {remaining.map((keyword) => (
              <option key={keyword} value={keyword}>
                {keyword}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
    if (segments === undefined) {
      title = (
        <label htmlFor={id} className="bd-field-label">
          {label}
        </label>
      );
    }
  } else {
    title = (
      <label htmlFor={id} className="bd-field-label">
        {label}
      </label>
    );
    body = (
      <ValueField
        {...base}
        keywords={keywords}
        inputId={id}
        path={pathOf(def)}
        label={label}
        hideLabel
        onSet={(value) => set(value)}
        onUnset={() => unset()}
      />
    );
  }

  return (
    <div
      className={`bd-field bd-style-field${props.inline === true ? ' bd-style-inline' : ''}`}
      data-style-prop={key}
      data-origin={origin}
    >
      {head(title)}
      {body}
    </div>
  );
}

/**
 * The Style tab (docs/editor.md#the-style-inspector): the style groups the component allows, each
 * property edited at the breakpoint being edited. Text is checked with the property's grammar and
 * the theme before anything is dispatched, so a value outside the grammar cannot be written; a value
 * that comes from a wider breakpoint is shown as such, and "Reset" removes only this layer's key.
 */
export function StyleInspector({ node, breakpoint, theme = defaultTheme }: StyleInspectorProps) {
  const t = useT();
  const manifest = useManifest();
  const doc = useEditorState((state) => state.doc);
  const readOnly = useEditorState((state) => state.readOnly);
  const [notice, setNotice] = useState('');
  const layer = breakpoint ?? 'base';
  const meta = componentMeta(manifest, node.type);
  const disabled = readOnly || !canEdit(doc, createIndex(doc), node.id, 'style').ok;
  const effective = effectiveStyles(node.styles ?? {}, layer, theme.breakpoints);
  const groups = STYLE_GROUPS.filter((group) => meta?.styles.groups.includes(group));

  if (groups.length === 0) {
    return <p className="bd-inspector-empty">{t('style.none')}</p>;
  }
  const knownLayer = layer === 'base' || theme.breakpoints.some((b) => b.id === layer);

  return (
    <div className="bd-styles" data-layer={layer}>
      <p className="bd-styles-layer">
        {`${t('style.editing')}: ${layer === 'base' ? t('style.desktop') : layer}`}
      </p>
      {!knownLayer ? <p className="bd-style-error">{t('style.unknownBreakpoint')}</p> : null}
      {groups.map((group) => (
        <StyleGroupSection
          key={group}
          group={group}
          nodeId={node.id}
          effective={effective}
          layer={layer}
          theme={theme}
          disabled={disabled || !knownLayer}
          onError={setNotice}
          boxBorder={groups.includes('spacing') && groups.includes('border')}
        />
      ))}
      <div role="status" className="bd-inspector-notice">
        {notice}
      </div>
    </div>
  );
}

function StyleGroupSection(props: {
  readonly group: StyleGroup;
  readonly nodeId: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
  /** Spacing and border are both allowed: border width sits between margin and padding. */
  readonly boxBorder: boolean;
}) {
  const t = useT();
  const borderWidth = getStyleProperty('border', 'width');
  const inBox = props.boxBorder && borderWidth !== undefined;
  const defs = propertiesOfGroup(props.group).filter(
    (def) =>
      getStyleProperty(def.group, def.name) !== undefined &&
      !(inBox && def.group === 'border' && def.name === 'width'),
  );
  const used = Object.keys(props.effective).some((path) => path.startsWith(`${props.group}.`));
  const byName = new Map(defs.map((def) => [def.name, def]));
  const common = {
    nodeId: props.nodeId,
    effective: props.effective,
    layer: props.layer,
    theme: props.theme,
    disabled: props.disabled,
    onError: props.onError,
  };

  // Margin wraps padding as a ring (the way the page nests them); pairs share one row.
  const nested = props.group === 'spacing' && byName.has('margin') && byName.has('padding');
  const paired = new Map<string, StylePropertyDef>();
  for (const [first, second] of PAIRS[props.group] ?? []) {
    const a = byName.get(first);
    const b = byName.get(second);
    if (a !== undefined && b !== undefined) paired.set(first, b);
  }
  const seconds = new Set([...paired.values()].map((def) => def.name));

  const rows: ReactNode[] = [];
  for (const def of defs) {
    if (seconds.has(def.name)) continue;
    if (nested && def.name === 'padding') continue;
    if (nested && def.name === 'margin') {
      const padding = (
        <StyleProperty def={byName.get('padding') as StylePropertyDef} ring {...common} />
      );
      rows.push(
        <StyleProperty key={def.name} def={def} ring {...common}>
          {inBox && borderWidth !== undefined ? (
            <StyleProperty def={borderWidth} ring {...common}>
              {padding}
            </StyleProperty>
          ) : (
            padding
          )}
        </StyleProperty>,
      );
      continue;
    }
    const second = paired.get(def.name);
    if (second !== undefined) {
      rows.push(
        <div key={def.name} className="bd-style-pair">
          <StyleProperty def={def} {...common} />
          <StyleProperty def={second} {...common} />
        </div>,
      );
      continue;
    }
    rows.push(<StyleProperty key={def.name} def={def} inline {...common} />);
  }

  return (
    <details className="bd-style-group" open={used} data-group={props.group}>
      <summary>{t(`style.group.${props.group}` as MessageKey)}</summary>
      {rows}
    </details>
  );
}
