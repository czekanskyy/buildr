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
import { useId, useState } from 'react';
import { componentMeta, useManifest } from '../../../app/manifest.tsx';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { useEditor, useEditorState } from '../../../store/index.ts';
import {
  ColorSwatch,
  IconButton,
  Input,
  NumberUnitInput,
  SegmentedControl,
  Tooltip,
} from '../../../ui/index.ts';
import { BoxModel } from './box-model.tsx';
import {
  checkStyleInput,
  colorOf,
  isEnumeration,
  isNumeric,
  keywordsOf,
  layerFor,
  partsOf,
  stepOf,
  takesNumber,
  unitsOf,
} from './model.ts';
import { SEGMENTED } from './segments.ts';
import { TokenPicker } from './token-picker.tsx';

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

/** One field for a single value (a whole property, one side or one corner). */
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
  const { def, path, effective } = props;
  const current = Object.hasOwn(effective, path) ? effective[path] : undefined;
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const shown = draft ?? (current !== undefined ? String(current.value) : '');
  const inherited = current !== undefined && current.source !== props.layer;

  const change = (text: string) => {
    setDraft(text);
    if (text.trim() === '') {
      setError('');
      if (current?.source === props.layer) props.onUnset();
      return;
    }
    const checked = checkStyleInput(def, text, props.theme);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError('');
    props.onSet(checked.value);
  };
  const pick = (ref: string) => {
    setDraft(undefined);
    setError('');
    props.onSet(ref);
  };
  // A field whose label is drawn by the caller (a box side) is named by aria-label instead.
  const ariaLabel =
    props.hideLabel === true && props.inputId === undefined ? props.label : undefined;
  const describedBy = error !== '' ? `${id}-error` : undefined;
  const listId = props.keywords.length > 0 ? `${id}-list` : undefined;
  const swatch = colorOf(def, shown.trim(), props.theme);
  const blur = () => {
    setDraft(undefined);
    setError('');
  };

  return (
    <div className="bd-style-value" data-path={path} data-source={current?.source ?? 'none'}>
      {props.hideLabel === true ? null : (
        <label htmlFor={id} className="bd-field-label">
          {props.label}
        </label>
      )}
      <div className="bd-style-input">
        {def.grammar.kind === 'color' ? <ColorSwatch color={swatch} /> : null}
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
            onValueChange={change}
            onBlur={blur}
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
            onChange={(event) => change(event.target.value)}
            onBlur={blur}
          />
        )}
        <TokenPicker
          def={def}
          theme={props.theme}
          label={props.label}
          current={current !== undefined ? String(current.value) : undefined}
          disabled={props.disabled}
          onPick={pick}
        />
      </div>
      {listId !== undefined ? (
        <datalist id={listId}>
          {props.keywords.map((keyword) => (
            <option key={keyword} value={keyword} />
          ))}
        </datalist>
      ) : null}
      {inherited ? (
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
}) {
  const t = useT();
  const store = useEditor();
  const { def, nodeId, effective, layer } = props;
  const id = useId();
  const label = humanize(def.name);
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
  /** Several sides at once (Alt-click in the box model) are one undo step. */
  const many = (sides: readonly string[], run: (side: string) => Result) => {
    if (sides.length === 1) return report(run(sides[0] as string));
    let failure = '';
    store.transaction(label, () => {
      for (const side of sides) {
        const result = run(side);
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

  const head = (control: React.ReactNode) => (
    <div className="bd-style-head">
      {control}
      <SourceDot origin={origin} from={from} />
      {here ? (
        <IconButton
          icon="rotate-ccw"
          className="bd-field-reset"
          disabled={props.disabled}
          label={`${t('inspector.reset')}: ${label}`}
          onClick={() =>
            parts.length > 0
              ? many(
                  parts.filter((part) => effective[pathOf(def, part)]?.source === layer),
                  unsetOne,
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

  let title: React.ReactNode = <span className="bd-field-label">{label}</span>;
  let body: React.ReactNode;
  if (def.shape === 'box') {
    body = (
      <BoxModel
        def={def}
        label={label}
        effective={effective}
        layer={layer}
        disabled={props.disabled}
        renderEditor={(sides) => {
          const first = sides[0] as string;
          return (
            <ValueField
              {...base}
              keywords={keywords}
              path={pathOf(def, first)}
              label={`${label} ${t(`style.side.${first}` as MessageKey)}`}
              hideLabel
              onSet={(value) => many(sides, (side) => setOne(value, side))}
              onUnset={() => many(sides, (side) => unsetOne(side))}
            />
          );
        }}
      />
    );
  } else if (parts.length > 0) {
    body = (
      <div className="bd-style-box" data-shape={def.shape}>
        {parts.map((part) => (
          <ValueField
            key={part}
            {...base}
            keywords={keywords}
            path={pathOf(def, part)}
            label={humanize(part)}
            onSet={(value) => set(value, part)}
            onUnset={() => unset(part)}
          />
        ))}
      </div>
    );
  } else if (isEnumeration(def)) {
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
              icon: segment.icon,
              iconOnly: true,
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
    <div className="bd-field bd-style-field" data-style-prop={key} data-origin={origin}>
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
}) {
  const t = useT();
  const defs = propertiesOfGroup(props.group).filter(
    (def) => getStyleProperty(def.group, def.name) !== undefined,
  );
  const used = Object.keys(props.effective).some((path) => path.startsWith(`${props.group}.`));
  return (
    <details className="bd-style-group" open={used} data-group={props.group}>
      <summary>{t(`style.group.${props.group}` as MessageKey)}</summary>
      {defs.map((def) => (
        <StyleProperty
          key={def.name}
          nodeId={props.nodeId}
          def={def}
          effective={props.effective}
          layer={props.layer}
          theme={props.theme}
          disabled={props.disabled}
          onError={props.onError}
        />
      ))}
    </details>
  );
}
