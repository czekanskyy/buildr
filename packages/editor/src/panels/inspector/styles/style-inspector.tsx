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
  type StyleState,
  type Theme,
} from '@next-buildr/core';
import { type ReactNode, useId, useState } from 'react';
import { componentMeta, useManifest } from '../../../app/manifest.tsx';
import { interpolate, type MessageKey, useT } from '../../../messages/index.tsx';
import { useEditor, useEditorState } from '../../../store/index.ts';
import { Icon, Input, NumberUnitInput, SegmentedControl, Tooltip } from '../../../ui/index.ts';
import { ScrubLabel } from '../scrub-label.tsx';
import { BoxModel } from './box-model.tsx';
import { GradientFields } from './gradient-fields.tsx';
import {
  boundsOf,
  checkStyleInput,
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
import { Highlight, propertyLabel } from './property-label.tsx';
import { StyleSection } from './section.tsx';
import { PAIRS, SEGMENTED } from './segments.ts';
import { SidesEditor, type SideWrite } from './sides-editor.tsx';
import { TokenPicker } from './token-picker.tsx';
import { useStyleValue } from './use-style-value.ts';
import { AlignmentPad, ColorField, RangeSlider, ResetField, ShadowEditor } from './widgets.tsx';

export interface StyleInspectorProps {
  readonly node: PageNode;
  /** The breakpoint being edited: `'base'` (desktop, the default) or a breakpoint id of the theme. */
  readonly breakpoint?: string;
  readonly theme?: Theme;
  /** The search text from the inspector header, which filters sections and properties. */
  readonly query?: string;
}

const pathOf = (def: StylePropertyDef, part?: string) =>
  `${def.group}.${def.name}${part !== undefined ? `.${part}` : ''}`;

function sourceLabel(source: string, t: (key: MessageKey) => string): string {
  if (source === 'base') return t('style.desktop');
  if (source === 'state:hover') return t('style.source.hover');
  if (source === 'state:focus-visible') return t('style.source.focus-visible');
  if (source === 'state:active') return t('style.source.active');
  return source;
}

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
      {path === 'size.width' ? (
        <SegmentedControl
          label={t('style.width.mode')}
          value={shown === '100%' ? 'full' : shown === 'auto' || shown === '' ? 'auto' : 'custom'}
          disabled={props.disabled}
          options={[
            { value: 'auto', label: t('style.width.auto') },
            { value: 'full', label: t('style.width.full') },
            { value: 'custom', label: t('style.width.custom') },
          ]}
          onValueChange={(mode) => {
            if (mode === 'custom') document.getElementById(id)?.focus();
            else field.change(mode === 'full' ? '100%' : 'auto');
          }}
        />
      ) : null}
      {props.hideLabel === true ? null : (
        <label htmlFor={id} className="bd-field-label">
          {props.label}
        </label>
      )}
      <div className="bd-style-input">
        {def.grammar.kind === 'color' ? (
          <ColorField
            id={id}
            text={shown}
            swatch={swatch}
            theme={props.theme}
            label={`${props.label}: ${t('style.colorPicker')}`}
            ariaLabel={ariaLabel}
            disabled={props.disabled}
            invalid={error !== ''}
            describedBy={describedBy}
            onText={field.change}
            onSwatch={(text) => {
              const checked = checkStyleInput(def, text, props.theme);
              if (checked.ok) field.pick(text);
            }}
            onBlur={field.blur}
            trailing={
              <TokenPicker
                def={def}
                theme={props.theme}
                label={props.label}
                current={current !== undefined ? String(current.value) : undefined}
                disabled={props.disabled}
                onPick={field.pick}
              />
            }
          />
        ) : null}
        {def.grammar.kind === 'color' ? null : isNumeric(def) ? (
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
        {def.grammar.kind === 'color' ? null : (
          <TokenPicker
            def={def}
            theme={props.theme}
            label={props.label}
            current={current !== undefined ? String(current.value) : undefined}
            disabled={props.disabled}
            onPick={field.pick}
          />
        )}
      </div>
      {def.grammar.kind === 'gradient' ? (
        <GradientFields
          value={field.stored}
          theme={props.theme}
          disabled={props.disabled}
          onChange={(text) => {
            const checked = checkStyleInput(def, text, props.theme);
            if (checked.ok) field.pick(text);
          }}
        />
      ) : null}
      {slider !== undefined ? (
        <RangeSlider
          label={`${props.label}: ${t('style.slider')}`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={
            Number.isFinite(Number(field.stored)) && field.stored !== ''
              ? Number(field.stored)
              : slider.max
          }
          disabled={props.disabled}
          onChange={field.change}
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
        <span className="bd-style-source">{`${t('style.from')} ${sourceLabel(current.source, t)}`}</span>
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
  /** The search text, highlighted in the label. */
  readonly query?: string;
}) {
  const t = useT();
  const store = useEditor();
  const { def, nodeId, effective, layer } = props;
  const id = useId();
  const label = propertyLabel(def, t);
  const shownLabel = <Highlight text={label} query={props.query} />;
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
  const from = known[0] !== undefined ? sourceLabel(known[0].source, t) : undefined;
  const base = { def, effective, layer, theme: props.theme, disabled: props.disabled };
  const keywords = keywordsOf(def);
  const key = pathOf(def);

  const head = (control: ReactNode, extras?: ReactNode) => (
    <div className="bd-style-head">
      {control}
      {extras}
      <SourceDot origin={origin} from={from} />
      {layer !== 'base' && !layer.startsWith('state:') ? (
        <Tooltip content={here ? t('style.override') : `${t('style.editing')}: ${layer}`}>
          <span
            className="bd-device-indicator"
            data-override={here}
            role="img"
            aria-label={here ? t('style.override') : layer}
          >
            <Icon
              name={
                layer === 'mobile'
                  ? 'smartphone'
                  : layer === 'tablet'
                    ? 'tablet'
                    : 'monitor-smartphone'
              }
            />
          </span>
        </Tooltip>
      ) : null}
      <ResetField
        label={label}
        changed={here}
        disabled={props.disabled}
        onReset={() =>
          parts.length > 0
            ? apply(
                parts
                  .filter((part) => effective[pathOf(def, part)]?.source === layer)
                  .map((part) => ({ part, value: undefined })),
              )
            : unset()
        }
      />
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
            {shownLabel}
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
          renderHead={(extras) =>
            head(<span className="bd-field-label">{shownLabel}</span>, extras)
          }
        >
          {props.children}
        </SidesEditor>
      </div>
    );
  }

  let title: ReactNode = <span className="bd-field-label">{shownLabel}</span>;
  let body: ReactNode;
  if (isEnumeration(def)) {
    const current = effective[key];
    const segments = SEGMENTED[key]?.filter((segment) => keywords.includes(segment.keyword));
    const currentText = current !== undefined ? String(current.value) : undefined;
    const currentLabel =
      current !== undefined ? `${String(current.value)} (${sourceLabel(current.source, t)})` : '—';
    const remaining =
      segments === undefined
        ? keywords
        : keywords.filter((keyword) => !segments.some((segment) => segment.keyword === keyword));
    body = (
      <div
        className="bd-style-enum"
        data-segmented={segments !== undefined ? '' : undefined}
        data-more={segments !== undefined && remaining.length > 0 ? '' : undefined}
      >
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
          {shownLabel}
        </label>
      );
    }
  } else {
    title = isNumeric(def) ? (
      <ScrubLabel
        htmlFor={id}
        value={String(effective[key]?.value ?? '')}
        step={stepOf(def)}
        {...boundsOf(def, String(effective[key]?.value ?? ''))}
        unit={takesNumber(def) ? '' : (unitsOf(def)[0] ?? '')}
        disabled={props.disabled}
        onValueChange={(text) => {
          const checked = checkStyleInput(def, text, props.theme);
          if (checked.ok) set(checked.value);
        }}
      >
        {shownLabel}
      </ScrubLabel>
    ) : (
      <label htmlFor={id} className="bd-field-label">
        {shownLabel}
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
      {key === 'background.imagePosition' ? (
        <AlignmentPad
          value={String(effective[key]?.value ?? 'center')}
          disabled={props.disabled}
          label={label}
          onPick={set}
        />
      ) : null}
      {key === 'effects.shadow' ? (
        <ShadowEditor
          theme={props.theme}
          value={String(effective[key]?.value ?? 'none')}
          disabled={props.disabled}
          onPick={set}
          onCustom={
            // Only when the property stores a custom shadow; today it takes tokens and `none`.
            checkStyleInput(def, '0px 4px 12px 0px #00000026', props.theme).ok
              ? (text) => {
                  const checked = checkStyleInput(def, text, props.theme);
                  if (checked.ok) set(checked.value);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

/**
 * The Style tab (docs/editor.md#the-style-inspector): the style groups the component allows, each
 * property edited at the breakpoint being edited. Text is checked with the property's grammar and
 * the theme before anything is dispatched, so a value outside the grammar cannot be written; a value
 * that comes from a wider breakpoint is shown as such, and "Reset" removes only this layer's key.
 */
export function StyleInspector({
  node,
  breakpoint,
  theme = defaultTheme,
  query,
}: StyleInspectorProps) {
  return (
    <SelectedStyleInspector
      key={node.id}
      node={node}
      {...(breakpoint !== undefined ? { breakpoint } : {})}
      theme={theme}
      {...(query !== undefined ? { query } : {})}
    />
  );
}

function SelectedStyleInspector({
  node,
  breakpoint,
  theme = defaultTheme,
  query = '',
}: StyleInspectorProps) {
  const t = useT();
  const manifest = useManifest();
  const doc = useEditorState((state) => state.doc);
  const readOnly = useEditorState((state) => state.readOnly);
  const [notice, setNotice] = useState('');
  const [state, setState] = useState<StyleState | 'normal'>('normal');
  const device = breakpoint ?? 'base';
  const layer = state === 'normal' ? device : `state:${state}`;
  const meta = componentMeta(manifest, node.type);
  const disabled = readOnly || !canEdit(doc, createIndex(doc), node.id, 'style').ok;
  const baseEffective = effectiveStyles(node.styles ?? {}, device, theme.breakpoints);
  const stateDecl = state === 'normal' ? undefined : node.styles?.state?.[state];
  const stateEffective =
    stateDecl === undefined ? {} : effectiveStyles({ base: stateDecl }, 'base', theme.breakpoints);
  const effective: EffectiveStyles =
    state === 'normal'
      ? baseEffective
      : {
          ...baseEffective,
          ...Object.fromEntries(
            Object.entries(stateEffective).map(([path, entry]) => [
              path,
              { ...entry, source: layer },
            ]),
          ),
        };
  const groups = STYLE_GROUPS.filter((group) => meta?.styles.groups.includes(group));

  if (groups.length === 0) {
    return <p className="bd-inspector-empty">{t('style.none')}</p>;
  }
  const knownLayer = device === 'base' || theme.breakpoints.some((b) => b.id === device);
  const maxWidth = theme.breakpoints.find((b) => b.id === device)?.maxWidth;
  const deviceName =
    device === 'tablet' || device === 'mobile'
      ? t(`inspector.device.${device}` as 'inspector.device.tablet')
      : device;
  const needle = query.trim().toLocaleLowerCase();
  const searching = needle !== '';
  const anyMatch = groups.some(
    (group) =>
      (group === 'typography'
        ? `${t('style.group.typography')} ${t('style.section.colors')}`
        : group === 'effects'
          ? `${t('style.group.effects')} ${t('style.section.shadow')}`
          : group === 'border'
            ? t('style.section.border')
            : t(`style.group.${group}` as MessageKey)
      )
        .toLocaleLowerCase()
        .includes(needle) ||
      propertiesOfGroup(group).some((def) =>
        propertyLabel(def, t).toLocaleLowerCase().includes(needle),
      ),
  );

  return (
    <div className="bd-styles" data-layer={layer}>
      <SegmentedControl
        label={t('style.state.label')}
        value={state}
        options={[
          { value: 'normal', label: t('style.state.normal') },
          { value: 'hover', label: t('style.state.hover') },
          { value: 'focus-visible', label: t('style.state.focus-visible') },
          { value: 'active', label: t('style.state.active') },
        ]}
        onValueChange={(value) => {
          if (
            value === 'normal' ||
            value === 'hover' ||
            value === 'focus-visible' ||
            value === 'active'
          )
            setState(value);
        }}
      />
      {state !== 'normal' ? (
        <div className="bd-note bd-note--info bd-styles-layer" role="status">
          <Icon name="monitor" />
          <span>{`${t('style.editing')}: ${t(`style.state.${state}`)}`}</span>
        </div>
      ) : device !== 'base' ? (
        <div className="bd-note bd-note--ovr bd-styles-layer" data-override="true" role="status">
          <Icon
            name={
              device === 'mobile'
                ? 'smartphone'
                : device === 'tablet'
                  ? 'tablet'
                  : 'monitor-smartphone'
            }
          />
          <span>
            {t('inspector.device.editing')} <b>{deviceName}</b>
            {maxWidth === undefined ? '' : ` (≤ ${maxWidth}px)`}. {t('inspector.device.hint')}
          </span>
        </div>
      ) : null}
      {!knownLayer ? <p className="bd-style-error">{t('style.unknownBreakpoint')}</p> : null}
      {searching && !anyMatch ? (
        <div className="bd-empty" role="status">
          <strong>{interpolate(t('inspector.search.noMatch'), { query: query.trim() })}</strong>
          <span>{t('inspector.search.hint')}</span>
        </div>
      ) : null}
      {groups.flatMap((group) => {
        const common = {
          group,
          nodeId: node.id,
          effective,
          layer,
          theme,
          disabled: disabled || !knownLayer,
          onError: setNotice,
          query: query.trim().toLocaleLowerCase(),
        };
        return [
          <StyleGroupSection key={group} {...common} />,
          ...(group === 'typography'
            ? [<StyleGroupSection key="colors" {...common} section="colors" />]
            : []),
          ...(group === 'effects'
            ? [<StyleGroupSection key="shadow" {...common} section="shadow" />]
            : []),
        ];
      })}
      <div role="status" className="bd-inspector-notice">
        {notice}
      </div>
    </div>
  );
}

function StyleGroupSection(props: {
  readonly group: StyleGroup;
  readonly section?: 'colors' | 'shadow';
  readonly nodeId: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
  readonly query: string;
}) {
  const t = useT();
  const section = props.section ?? props.group;
  const sectionLabel =
    props.section !== undefined
      ? t(`style.section.${props.section}`)
      : props.group === 'border'
        ? t('style.section.border')
        : t(`style.group.${props.group}` as MessageKey);
  const store = useEditor();
  const [moreDims, setMoreDims] = useState(false);
  // Every property of the section, whatever the search says: "Reset section" and the counts use it.
  const sectionDefs = propertiesOfGroup(props.group).filter(
    (def) =>
      getStyleProperty(def.group, def.name) !== undefined &&
      (!props.layer.startsWith('state:') || def.allowInStates) &&
      (props.group !== 'typography' ||
        (props.section === 'colors' ? def.name === 'color' : def.name !== 'color')) &&
      (props.group !== 'effects' ||
        (props.section === 'shadow' ? def.name === 'shadow' : def.name !== 'shadow')),
  );
  const matching = sectionDefs.filter(
    (def) =>
      props.query === '' ||
      sectionLabel.toLocaleLowerCase().includes(props.query) ||
      propertyLabel(def, t).toLocaleLowerCase().includes(props.query),
  );
  const relevant = Object.entries(props.effective).filter(([path]) =>
    sectionDefs.some((def) => path === pathOf(def) || path.startsWith(`${pathOf(def)}.`)),
  );
  const used = relevant.length > 0;
  // Min. and max. dimensions sit behind a disclosure until one has a value or the search finds it.
  const isLimit = (def: StylePropertyDef) =>
    props.group === 'size' && /^(min|max)(Width|Height)$/.test(def.name);
  const limitUsed = sectionDefs.some(
    (def) =>
      isLimit(def) &&
      Object.keys(props.effective).some((path) => path.startsWith(`${pathOf(def)}`)),
  );
  const showLimits = moreDims || limitUsed || props.query !== '';
  const defs = matching.filter((def) => !isLimit(def) || showLimits);
  const hasLimits = props.query === '' && sectionDefs.some(isLimit);
  /** Paths written at the layer being edited: what "Reset section" removes. */
  const here = sectionDefs.flatMap((def) => {
    const parts = partsOf(def);
    return (parts.length > 0 ? parts.map((part) => ({ def, part })) : [{ def, part: undefined }])
      .filter(({ part }) => props.effective[pathOf(def, part)]?.source === props.layer)
      .map(({ part }) => ({ def, part }));
  });
  const isBreakpoint = props.layer !== 'base' && !props.layer.startsWith('state:');
  const resetSection = () => {
    let failure = '';
    // The same command as the per-property reset, one undo step for the whole section.
    store.transaction(sectionLabel, () => {
      for (const { def, part } of here) {
        const result = store.dispatch({
          type: 'node.unsetStyle',
          payload: {
            id: props.nodeId,
            layer: layerFor(props.layer),
            group: def.group,
            property: def.name,
            ...(part !== undefined ? { side: part } : {}),
          },
        });
        if (!result.ok) failure ||= result.error?.message ?? '';
      }
      return failure === '';
    });
    props.onError(failure);
  };
  const byName = new Map(defs.map((def) => [def.name, def]));
  const common = {
    nodeId: props.nodeId,
    effective: props.effective,
    layer: props.layer,
    theme: props.theme,
    disabled: props.disabled,
    onError: props.onError,
    query: props.query,
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
        <BoxModel key="box-model">
          <StyleProperty def={def} ring {...common}>
            {padding}
          </StyleProperty>
        </BoxModel>,
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

  if (defs.length === 0) return null;
  return (
    <StyleSection
      name={section}
      label={sectionLabel}
      defaultOpen={used || props.group === 'layout' || props.group === 'spacing'}
      searching={props.query !== ''}
      modified={used}
      override={isBreakpoint && here.length > 0}
      overrideCount={isBreakpoint ? here.length : 0}
      layer={props.layer}
      query={props.query}
      onReset={here.length > 0 ? resetSection : undefined}
      resetDisabled={props.disabled}
    >
      {props.group === 'layout' && props.query === '' ? <LayoutAlignment {...common} /> : null}
      {rows}
      {hasLimits ? (
        <button
          type="button"
          className="bd-textbtn bd-more-dims"
          aria-expanded={showLimits}
          disabled={limitUsed}
          onClick={() => setMoreDims(!moreDims)}
        >
          <Icon name={showLimits ? 'chevron-up' : 'chevron-down'} />
          {showLimits ? t('styleField.dimensions.fewer') : t('styleField.dimensions.more')}
        </button>
      ) : null}
    </StyleSection>
  );
}

/** The pad is a shortcut for the same two layout commands as the individual segments. */
function LayoutAlignment(props: {
  readonly nodeId: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
}) {
  const t = useT();
  const store = useEditor();
  const display = props.effective['layout.display']?.value;
  if (display !== 'flex' && display !== 'inline-flex') return null;
  const direction = String(props.effective['layout.direction']?.value ?? 'row');
  const column = direction.startsWith('column');
  const reverse = direction.endsWith('reverse');
  const values = ['flex-start', 'center', 'flex-end'];
  const main = String(props.effective['layout.justify']?.value ?? 'flex-start');
  const cross = String(props.effective['layout.align']?.value ?? 'stretch');
  const at = (value: string) =>
    values.indexOf(value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : value);
  const mainIndex = at(main);
  const crossIndex = at(cross);
  const j = reverse && mainIndex !== -1 ? 2 - mainIndex : mainIndex;
  const x = column ? crossIndex : j;
  const y = column ? j : crossIndex;
  const positions = [
    'top left',
    'top',
    'top right',
    'left',
    'center',
    'right',
    'bottom left',
    'bottom',
    'bottom right',
  ];
  return (
    <div className="bd-layout-alignment">
      <span className="bd-field-label">{t('style.alignment')}</span>
      <AlignmentPad
        column={column}
        hint={t(column ? 'styleField.align.helpColumn' : 'styleField.align.helpRow')}
        label={t('style.alignment')}
        value={x < 0 || y < 0 ? '' : (positions[y * 3 + x] ?? '')}
        disabled={props.disabled}
        onPick={(position) => {
          const index = positions.indexOf(position);
          if (index < 0) return;
          const row = Math.floor(index / 3);
          const col = index % 3;
          const mainAxis = column ? row : col;
          const result = store.dispatchBatch(
            [
              {
                type: 'node.setStyle',
                payload: {
                  id: props.nodeId,
                  layer: layerFor(props.layer),
                  group: 'layout',
                  property: 'justify',
                  value: values[reverse ? 2 - mainAxis : mainAxis] ?? 'center',
                },
              },
              {
                type: 'node.setStyle',
                payload: {
                  id: props.nodeId,
                  layer: layerFor(props.layer),
                  group: 'layout',
                  property: 'align',
                  value: values[column ? col : row] ?? 'center',
                },
              },
            ],
            { label: t('style.alignment') },
          );
          props.onError(result.ok ? '' : (result.error?.message ?? ''));
        }}
      />
    </div>
  );
}
