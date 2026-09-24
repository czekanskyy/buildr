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
} from '@buildr/core';
import { useId, useState } from 'react';
import { componentMeta, useManifest } from '../../../app/manifest.tsx';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { useEditor, useEditorState } from '../../../store/index.ts';
import { Button, Input } from '../../../ui/index.ts';
import {
  checkStyleInput,
  isEnumeration,
  keywordsOf,
  layerFor,
  partsOf,
  tokenSuggestions,
} from './model.ts';

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

/** One text field for a single value (a whole property, one side or one corner). */
function ValueField(props: {
  readonly def: StylePropertyDef;
  readonly path: string;
  readonly label: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly theme: Theme;
  readonly disabled: boolean;
  readonly suggestions: readonly string[];
  readonly onSet: (value: string | number) => void;
  readonly onUnset: () => void;
}) {
  const t = useT();
  const id = useId();
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

  return (
    <div className="bd-style-value" data-path={path} data-source={current?.source ?? 'none'}>
      <label htmlFor={id} className="bd-field-label">
        {props.label}
      </label>
      <Input
        id={id}
        value={shown}
        disabled={props.disabled}
        list={props.suggestions.length > 0 ? `${id}-list` : undefined}
        aria-invalid={error !== ''}
        aria-describedby={error !== '' ? `${id}-error` : undefined}
        placeholder={inherited ? '' : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => change(event.target.value)}
        onBlur={() => {
          setDraft(undefined);
          setError('');
        }}
      />
      {props.suggestions.length > 0 ? (
        <datalist id={`${id}-list`}>
          {props.suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
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
  const report = (result: {
    readonly ok: boolean;
    readonly error?: { readonly message: string };
  }) => props.onError(result.ok ? '' : (result.error?.message ?? ''));

  const set = (value: string | number | boolean, part?: string) =>
    report(
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
      }),
    );
  const unset = (part?: string) =>
    report(
      store.dispatch({
        type: 'node.unsetStyle',
        payload: {
          id: nodeId,
          layer: layerObject,
          group: def.group,
          property: def.name,
          ...(part !== undefined ? { side: part } : {}),
        },
      }),
    );

  const paths = parts.length > 0 ? parts.map((part) => pathOf(def, part)) : [pathOf(def)];
  const setHere = paths.some((path) => effective[path]?.source === layer);
  const suggestions = [...keywordsOf(def), ...tokenSuggestions(def, props.theme)];
  const base = {
    def,
    effective,
    layer,
    theme: props.theme,
    disabled: props.disabled,
    suggestions,
  };

  let body: React.ReactNode;
  if (def.grammar.kind === 'boolean') {
    const value = effective[pathOf(def)];
    body = (
      <label className="bd-style-check">
        <input
          type="checkbox"
          checked={value?.value === true}
          disabled={props.disabled}
          onChange={(event) => (event.target.checked ? set(true) : unset())}
        />
        {label}
      </label>
    );
  } else if (parts.length > 0) {
    body = (
      <div className="bd-style-box" data-shape={def.shape}>
        {parts.map((part) => (
          <ValueField
            key={part}
            {...base}
            path={pathOf(def, part)}
            label={humanize(part)}
            onSet={(value) => set(value, part)}
            onUnset={() => unset(part)}
          />
        ))}
      </div>
    );
  } else if (isEnumeration(def)) {
    const current = effective[pathOf(def)];
    body = (
      <>
        <label htmlFor={id} className="bd-field-label">
          {label}
        </label>
        <select
          id={id}
          className="bd-input"
          value={current?.source === layer ? String(current.value) : ''}
          disabled={props.disabled}
          onChange={(event) => (event.target.value === '' ? unset() : set(event.target.value))}
        >
          <option value="">
            {current !== undefined
              ? `${String(current.value)} (${current.source === 'base' ? t('style.desktop') : current.source})`
              : '—'}
          </option>
          {keywordsOf(def).map((keyword) => (
            <option key={keyword} value={keyword}>
              {keyword}
            </option>
          ))}
        </select>
      </>
    );
  } else {
    body = (
      <ValueField
        {...base}
        path={pathOf(def)}
        label={label}
        onSet={(value) => set(value)}
        onUnset={() => unset()}
      />
    );
  }

  return (
    <div className="bd-field" data-style-prop={pathOf(def)}>
      {body}
      {setHere ? (
        <Button
          variant="ghost"
          className="bd-field-reset"
          disabled={props.disabled}
          aria-label={`${t('inspector.reset')}: ${label}`}
          onClick={() => unset()}
        >
          {t('inspector.reset')}
        </Button>
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
