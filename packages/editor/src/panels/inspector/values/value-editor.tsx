import {
  type BindingValue,
  bind,
  type DataTypeTag,
  type ExpressionValue,
  expr,
  type FormatSpec,
  type PropDef,
  schemaAtPath,
  type Value,
} from '@buildr/core';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { type MessageKey, useT } from '../../../messages/index.tsx';
import { Button, Input, Select } from '../../../ui/index.ts';
import {
  type BindingStatus,
  bindingOptions,
  checkBinding,
  checkFormula,
  defaultFormat,
  type FormatKind,
  type FormulaMode,
  formatKindsFor,
  previewValue,
  spanOf,
} from './analyze.ts';
import { useInspectorData } from './data.tsx';

/** How many fields the picker lists at once; a long list is narrowed with the search. */
const MAX_LISTED = 100;

type Mode = 'static' | 'binding' | 'expression';

export interface ValueEditorProps {
  readonly def: PropDef;
  readonly label: string;
  /** The node's own value for the prop (`undefined` while it still shows the default). */
  readonly raw: Value | undefined;
  readonly disabled: boolean;
  /** The control for a fixed value; shown in the "Fixed" mode. */
  readonly staticControl: ReactNode;
  /** Writes a binding or a formula. */
  readonly onSet: (value: Value) => void;
  /** Back to a fixed value: the prop shows its default again. */
  readonly onFixed: () => void;
}

const modeOf = (raw: Value | undefined): Mode =>
  raw?.kind === 'binding' ? 'binding' : raw?.kind === 'expression' ? 'expression' : 'static';

/**
 * The switch between a fixed value, a field of the data and a formula
 * (docs/editor.md#value-modes-and-the-binding-picker-pb-081), and the editor of the chosen mode. A
 * prop that takes no bindings (`accepts` is empty) has no switch. A mode the prop is switched to
 * but has no value in yet (no field picked, no valid formula) is only shown, not written: nothing
 * invalid reaches the document.
 */
export function ValueEditor({
  def,
  label,
  raw,
  disabled,
  staticControl,
  onSet,
  onFixed,
}: ValueEditorProps) {
  const t = useT();
  const [pending, setPending] = useState<Mode | null>(null);
  const saved = modeOf(raw);
  const mode = saved === 'static' && pending !== null ? pending : saved;
  const canBind = def.accepts.length > 0;

  if (!canBind) {
    return raw !== undefined && raw.kind !== 'static' ? (
      <ValueChip def={def} value={raw} />
    ) : (
      <>{staticControl}</>
    );
  }

  const choose = (next: Mode) => {
    if (next === mode) return;
    if (next === 'static') {
      setPending(null);
      if (saved !== 'static') onFixed();
      return;
    }
    setPending(next);
  };
  const modes: { mode: Mode; key: MessageKey }[] = [
    { mode: 'static', key: 'values.mode.static' },
    { mode: 'binding', key: 'values.mode.binding' },
    { mode: 'expression', key: 'values.mode.formula' },
  ];

  return (
    <div className="bd-value" data-mode={mode}>
      <fieldset className="bd-value-modes" aria-label={`${label}: ${t('values.mode')}`}>
        {modes.map((entry) => (
          <Button
            key={entry.mode}
            variant="ghost"
            aria-pressed={mode === entry.mode}
            disabled={disabled}
            onClick={() => choose(entry.mode)}
          >
            {t(entry.key)}
          </Button>
        ))}
      </fieldset>
      {mode === 'static' ? staticControl : null}
      {mode === 'binding' ? (
        <BindingEditor
          def={def}
          label={label}
          raw={raw?.kind === 'binding' ? raw : undefined}
          disabled={disabled}
          onSet={onSet}
        />
      ) : null}
      {mode === 'expression' ? (
        <FormulaEditor
          def={def}
          label={label}
          raw={raw?.kind === 'expression' ? raw : undefined}
          disabled={disabled}
          onSet={onSet}
        />
      ) : null}
    </div>
  );
}

// --- the chip -----------------------------------------------------------------------------------

export interface ValueChipProps {
  readonly def: PropDef;
  readonly value: Value;
}

/** What a bound or formula prop shows where a control would be: the path or the formula, red when it is wrong. */
export function ValueChip({ def, value }: ValueChipProps) {
  const t = useT();
  const { schema } = useInspectorData();
  if (value.kind === 'static') return null;
  const invalid =
    value.kind === 'binding'
      ? ['missing', 'type'].includes(checkBinding(schema, value.path, def.accepts))
      : !checkFormula(value.expr, value.mode ?? 'formula', schema, def.accepts).valid;
  return (
    <p className="bd-field-chip bd-value-chip" data-invalid={invalid}>
      {value.kind === 'binding' ? t('inspector.bound') : t('inspector.formula')}:{' '}
      <code>{value.kind === 'binding' ? value.path : value.expr}</code>
      {invalid ? <span> ({t('values.chip.invalid')})</span> : null}
    </p>
  );
}

// --- shared pieces ------------------------------------------------------------------------------

function Preview({ value }: { readonly value: Value }) {
  const t = useT();
  const { context } = useInspectorData();
  const preview = useMemo(() => previewValue(value, context), [value, context]);
  if (context === undefined) return null;
  return (
    <p className="bd-value-preview">
      <span className="bd-value-preview-label">{t('values.preview')}: </span>
      {preview.text !== undefined ? (
        <output>{preview.text}</output>
      ) : (
        <span className="bd-value-preview-none">{t('values.preview.none')}</span>
      )}
    </p>
  );
}

function Fallback(props: {
  readonly def: PropDef;
  readonly value: unknown;
  readonly disabled: boolean;
  readonly onChange: (fallback: string | number | undefined) => void;
}) {
  const t = useT();
  const shown = props.value === undefined || props.value === null ? '' : String(props.value);
  return (
    <div className="bd-value-row">
      <span>{t('values.fallback')}</span>
      <Input
        aria-label={t('values.fallback')}
        type="text"
        value={shown}
        disabled={props.disabled}
        onChange={(event) => {
          const text = event.target.value;
          if (text === '') return props.onChange(undefined);
          const number = Number(text);
          props.onChange(props.def.kind === 'number' && Number.isFinite(number) ? number : text);
        }}
      />
    </div>
  );
}

// --- data bindings ------------------------------------------------------------------------------

const STATUS_KEY: Partial<Record<BindingStatus, MessageKey>> = {
  missing: 'values.binding.missing',
  type: 'values.binding.type',
};

function BindingEditor(props: {
  readonly def: PropDef;
  readonly label: string;
  readonly raw: BindingValue | undefined;
  readonly disabled: boolean;
  readonly onSet: (value: Value) => void;
}) {
  const { def, raw, disabled, onSet } = props;
  const t = useT();
  const { schema } = useInspectorData();
  const pathId = useId();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(raw?.path ?? '');
  useEffect(() => setDraft(raw?.path ?? ''), [raw?.path]);

  const options = useMemo(() => bindingOptions(schema, def.accepts), [schema, def.accepts]);
  const needle = query.trim().toLowerCase();
  const listed = options.filter(
    (option) =>
      needle === '' ||
      option.path.toLowerCase().includes(needle) ||
      (option.label?.toLowerCase().includes(needle) ?? false),
  );
  const status = raw === undefined ? 'unchecked' : checkBinding(schema, raw.path, def.accepts);
  const statusKey = STATUS_KEY[status];
  const tag: DataTypeTag | undefined =
    raw === undefined || schema === undefined ? undefined : schemaAtPath(schema, raw.path)?.type.t;

  const write = (
    path: string,
    extra: { format?: FormatSpec | undefined; fallback?: string | number | undefined },
  ) =>
    onSet(
      bind(path, {
        ...(extra.format !== undefined ? { format: extra.format } : {}),
        ...(extra.fallback !== undefined ? { fallback: extra.fallback } : {}),
      }),
    );
  const keep = { format: raw?.format, fallback: raw?.fallback as string | number | undefined };
  const commitPath = (path: string) => {
    const trimmed = path.trim();
    if (trimmed === '' || trimmed === raw?.path) return;
    write(trimmed, keep);
  };

  return (
    <div className="bd-value-binding">
      {raw !== undefined ? <ValueChip def={def} value={raw} /> : null}
      <label className="bd-value-row" htmlFor={pathId}>
        <span>{t('values.binding.path')}</span>
      </label>
      <Input
        id={pathId}
        type="text"
        value={draft}
        disabled={disabled}
        aria-invalid={statusKey !== undefined}
        placeholder={t('values.binding.pick')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitPath(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitPath(draft);
        }}
      />
      {statusKey !== undefined ? (
        <p className="bd-value-error" role="alert">
          {t(statusKey)}
        </p>
      ) : null}
      {schema === undefined ? (
        <p className="bd-field-hint">{t('values.binding.noSchema')}</p>
      ) : (
        <>
          <Input
            type="search"
            value={query}
            disabled={disabled}
            aria-label={t('values.binding.search')}
            placeholder={t('values.binding.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {listed.length === 0 ? (
            <p className="bd-field-hint">{t('values.binding.none')}</p>
          ) : (
            <ul className="bd-value-fields">
              {listed.slice(0, MAX_LISTED).map((option) => (
                <li key={option.path}>
                  <button
                    type="button"
                    className="bd-value-field"
                    aria-pressed={raw?.path === option.path}
                    disabled={disabled}
                    onClick={() => write(option.path, keep)}
                  >
                    <code>{option.path}</code>
                    <span className="bd-value-field-type">{option.tag}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {raw !== undefined ? (
        <>
          <FormatEditor
            format={raw.format}
            tag={tag}
            disabled={disabled}
            onChange={(format) => write(raw.path, { format, fallback: keep.fallback })}
          />
          <Fallback
            def={def}
            value={raw.fallback}
            disabled={disabled}
            onChange={(fallback) => write(raw.path, { format: raw.format, fallback })}
          />
          <Preview value={raw} />
        </>
      ) : null}
    </div>
  );
}

function FormatEditor(props: {
  readonly format: FormatSpec | undefined;
  readonly tag: DataTypeTag | undefined;
  readonly disabled: boolean;
  readonly onChange: (format: FormatSpec | undefined) => void;
}) {
  const { format, disabled, onChange } = props;
  const t = useT();
  const kinds = formatKindsFor(props.tag);
  if (kinds.length <= 1 && format === undefined) return null;
  const kind: FormatKind = format?.type ?? 'none';
  const opts = <V extends string>(values: readonly V[], key: (value: V) => MessageKey) =>
    values.map((value) => ({ value, label: t(key(value)) }));

  return (
    <div className="bd-value-format">
      <Select
        label={t('values.format')}
        value={kind}
        disabled={disabled}
        options={opts(kinds, (value) => `values.format.${value}`)}
        onValueChange={(next) => onChange(defaultFormat(next as FormatKind))}
      />
      {format?.type === 'date' ? (
        <Select
          label={t('values.format.dateStyle')}
          value={format.style}
          disabled={disabled}
          options={opts(['short', 'medium', 'long', 'iso'] as const, (v) => `values.style.${v}`)}
          onValueChange={(style) => onChange({ type: 'date', style: style as typeof format.style })}
        />
      ) : null}
      {format?.type === 'number' ? (
        <Select
          label={t('values.format.numberStyle')}
          value={format.style ?? 'decimal'}
          disabled={disabled}
          options={opts(['decimal', 'percent'] as const, (v) => `values.style.${v}`)}
          onValueChange={(style) => onChange({ ...format, style: style as 'decimal' | 'percent' })}
        />
      ) : null}
      {format?.type === 'currency' ? (
        <div className="bd-value-row">
          <span>{t('values.format.currencyCode')}</span>
          <Input
            aria-label={t('values.format.currencyCode')}
            type="text"
            value={format.currency}
            maxLength={3}
            disabled={disabled}
            onChange={(event) => {
              const currency = event.target.value.toUpperCase();
              if (/^[A-Z]{3}$/.test(currency)) onChange({ type: 'currency', currency });
            }}
          />
        </div>
      ) : null}
      {format?.type === 'text' ? (
        <Select
          label={t('values.format.transform')}
          value={format.transform ?? 'none'}
          disabled={disabled}
          options={opts(
            ['none', 'upper', 'lower', 'capitalize'] as const,
            (v) => `values.transform.${v}`,
          )}
          onValueChange={(transform) => {
            const { transform: _drop, ...rest } = format;
            onChange(
              transform === 'none'
                ? rest
                : { ...rest, transform: transform as 'upper' | 'lower' | 'capitalize' },
            );
          }}
        />
      ) : null}
    </div>
  );
}

// --- formulas -----------------------------------------------------------------------------------

function FormulaEditor(props: {
  readonly def: PropDef;
  readonly label: string;
  readonly raw: ExpressionValue | undefined;
  readonly disabled: boolean;
  readonly onSet: (value: Value) => void;
}) {
  const { def, raw, disabled, onSet } = props;
  const t = useT();
  const { schema } = useInspectorData();
  const sourceId = useId();
  const [draft, setDraft] = useState(raw?.expr ?? '');
  const [mode, setMode] = useState<FormulaMode>(raw?.mode ?? 'formula');
  // An undo (or anything else that changes the saved formula) replaces the draft.
  useEffect(() => {
    if (raw !== undefined) {
      setDraft(raw.expr);
      setMode(raw.mode ?? 'formula');
    }
  }, [raw?.expr, raw?.mode, raw]);

  const check = useMemo(
    () => checkFormula(draft, mode, schema, def.accepts),
    [draft, mode, schema, def.accepts],
  );
  const fallback = raw?.fallback as string | number | undefined;
  const emit = (source: string, nextMode: FormulaMode, nextFallback = fallback) =>
    onSet(
      expr(source, {
        ...(nextMode === 'template' ? { mode: 'template' as const } : {}),
        ...(nextFallback !== undefined ? { fallback: nextFallback } : {}),
        // A translation belongs to the formula it was written for.
        ...(raw?.l10n !== undefined && raw.expr === source ? { l10n: raw.l10n } : {}),
      }),
    );
  // Only a formula that checks out is written; the fallback of a saved one is always editable.
  const write = (source: string, nextMode: FormulaMode) => {
    if (checkFormula(source, nextMode, schema, def.accepts).valid) emit(source, nextMode);
  };
  const saved = raw !== undefined && raw.expr === draft && (raw.mode ?? 'formula') === mode;
  const modes: FormulaMode[] = ['formula', 'template'];

  return (
    <div className="bd-value-formula">
      {raw !== undefined ? <ValueChip def={def} value={raw} /> : null}
      <fieldset className="bd-value-modes" aria-label={t('values.formula.mode')}>
        {modes.map((entry) => (
          <Button
            key={entry}
            variant="ghost"
            aria-pressed={mode === entry}
            disabled={disabled}
            onClick={() => {
              setMode(entry);
              write(draft, entry);
            }}
          >
            {t(`values.formula.mode.${entry}`)}
          </Button>
        ))}
      </fieldset>
      <label className="bd-value-row" htmlFor={sourceId}>
        <span>{t('values.formula.source')}</span>
      </label>
      <textarea
        id={sourceId}
        className="bd-input bd-value-source"
        rows={3}
        value={draft}
        disabled={disabled}
        spellCheck={false}
        aria-invalid={!check.valid}
        onChange={(event) => {
          setDraft(event.target.value);
          write(event.target.value, mode);
        }}
      />
      {draft !== '' && check.diagnostics.length > 0 ? (
        <ul className="bd-value-diagnostics" aria-live="polite">
          {check.diagnostics.map((diagnostic, index) => {
            const span = spanOf(diagnostic);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a list rebuilt on every edit, with no identity of its own
                key={index}
                data-severity={diagnostic.severity}
              >
                {span !== undefined ? <code>{draft.slice(span.start, span.end)}</code> : null}{' '}
                {diagnostic.message}
              </li>
            );
          })}
        </ul>
      ) : null}
      {draft !== '' && !check.valid && !saved ? (
        <p className="bd-value-error" role="alert">
          {t('values.formula.unsaved')}
        </p>
      ) : null}
      {check.valid && check.diagnostics.length === 0 && draft !== '' ? (
        <p className="bd-field-hint">{t('values.formula.valid')}</p>
      ) : null}
      {raw !== undefined ? (
        <>
          <Fallback
            def={def}
            value={raw.fallback}
            disabled={disabled}
            onChange={(next) => emit(raw.expr, raw.mode ?? 'formula', next)}
          />
          <Preview value={raw} />
        </>
      ) : null}
    </div>
  );
}
