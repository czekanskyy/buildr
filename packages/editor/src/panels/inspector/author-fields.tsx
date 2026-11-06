import {
  checkAttributes,
  checkClasses,
  compileCustomCss,
  MAX_ATTRIBUTES,
  MAX_CLASSES,
  MAX_CUSTOM_CSS_LENGTH,
  type PageNode,
} from '@next-buildr/core';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { interpolate, useT } from '../../messages/index.tsx';
import { useEditor } from '../../store/index.ts';
import { Button, IconButton, Input } from '../../ui/index.ts';

/*
 * The Advanced fields of ADR-026 (custom CSS, classes, attributes). They are only drawn when the host
 * permits author code, and they write through `node.setAttr`: the command checks the value again
 * and refuses it without the capability, so what is shown here is a convenience, not the guard.
 * What is typed stays on screen until it is valid; a refused value never reaches the document.
 */

interface FieldProps {
  readonly node: PageNode;
  readonly disabled: boolean;
}

type AttrKey = 'customCss' | 'classes' | 'attributes';

/** Adds " (line N)" to a CSS problem that quotes a piece of the source: the first line it appears on. */
export function describeCssProblem(source: string, message: string, line: string): string {
  const quoted = /"([^"]{1,40})"/.exec(message)?.[1];
  const at = quoted === undefined ? -1 : source.indexOf(quoted);
  if (at < 0) return message;
  return `${message} (${interpolate(line, { line: String(source.slice(0, at).split('\n').length) })})`;
}

/** Why a CSS source cannot be stored; empty when it can (or when it is empty). */
export function cssProblems(source: string): readonly string[] {
  return source.trim() === '' ? [] : compileCustomCss('.b-check', source).errors;
}

/** Runs `node.setAttr`; the message of a refusal, or `''`. */
function useWriteAttr(nodeId: string) {
  const store = useEditor();
  return (
    key: AttrKey,
    value: string | readonly string[] | Readonly<Record<string, string>> | null,
  ) => {
    const result = store.dispatch({
      type: 'node.setAttr',
      payload: { id: nodeId, key, value } as never,
    });
    return result.ok ? '' : (result.error?.message ?? '');
  };
}

function Problems(props: {
  readonly id: string;
  readonly title: string;
  readonly list: readonly string[];
}) {
  if (props.list.length === 0) return null;
  return (
    <div id={props.id} role="alert" className="bd-author-problems">
      <strong>{props.title}</strong>
      <ul>
        {props.list.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

/** Custom CSS for the block: a code field that applies when it loses focus (or with Ctrl+Enter) and only when valid. */
export function CssField({ node, disabled }: FieldProps) {
  const t = useT();
  const id = useId();
  const write = useWriteAttr(node.id);
  const stored = node.customCss ?? '';
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [refused, setRefused] = useState('');
  const shown = draft ?? stored;
  // An undo or a redo changes the stored CSS: show it, dropping a draft it replaces.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the stored value resets the draft
  useEffect(() => {
    setDraft(undefined);
    setRefused('');
  }, [stored]);
  const line = t('inspector.css.line');
  const problems = useMemo(
    () => cssProblems(shown).map((message) => describeCssProblem(shown, message, line)),
    [shown, line],
  );
  const list = refused !== '' && problems.length === 0 ? [refused] : problems;

  const apply = () => {
    if (draft === undefined || problems.length > 0) return;
    const value = draft.trim();
    if (value === stored.trim()) {
      setDraft(undefined);
      return;
    }
    const message = write('customCss', value === '' ? null : value);
    setRefused(message);
    if (message === '') setDraft(undefined);
  };
  const remove = () => {
    setRefused(write('customCss', null));
    setDraft(undefined);
  };
  const errorId = `${id}-error`;
  return (
    <div className="bd-field bd-author-field" data-attr="customCss">
      <div className="bd-field-head">
        <label className="bd-field-label" htmlFor={id}>
          {t('inspector.css.label')}
        </label>
      </div>
      <textarea
        id={id}
        className="bd-input bd-textarea bd-code"
        rows={8}
        value={shown}
        maxLength={MAX_CUSTOM_CSS_LENGTH}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        placeholder="& { }"
        aria-invalid={list.length > 0}
        aria-describedby={list.length > 0 ? errorId : `${id}-hint`}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefused('');
        }}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      <Problems id={errorId} title={t('inspector.css.error')} list={list} />
      <p className="bd-field-hint" id={`${id}-hint`}>
        {t('inspector.css.hint')}
      </p>
      <div className="bd-author-actions">
        <Button
          variant="ghost"
          disabled={disabled || draft === undefined || problems.length > 0}
          onClick={apply}
        >
          {t('inspector.css.apply')}
        </Button>
        {stored !== '' ? (
          <Button variant="ghost" disabled={disabled} onClick={remove}>
            {t('inspector.css.remove')}
          </Button>
        ) : null}
        {draft === undefined && stored !== '' ? (
          <span className="bd-author-ok" role="status">
            {t('inspector.css.applied')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const tokensOf = (text: string): string[] => text.split(/\s+/).filter((part) => part !== '');

/** CSS classes of the block, as a space-separated list. */
export function ClassesField({ node, disabled }: FieldProps) {
  const t = useT();
  const id = useId();
  const write = useWriteAttr(node.id);
  const stored = (node.classes ?? []).join(' ');
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [refused, setRefused] = useState('');
  const shown = draft ?? stored;
  // An undo or a redo changes the stored classes: show them, dropping a draft they replace.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the stored value resets the draft
  useEffect(() => {
    setDraft(undefined);
    setRefused('');
  }, [stored]);
  const checked = useMemo(() => {
    const names = tokensOf(shown);
    return names.length === 0 ? undefined : checkClasses(names);
  }, [shown]);
  const problem = checked !== undefined && !checked.ok ? checked.error : refused;
  const apply = () => {
    if (draft === undefined || (checked !== undefined && !checked.ok)) return;
    const names = checked?.ok === true ? checked.value : [];
    if (names.join(' ') === stored) {
      setDraft(undefined);
      return;
    }
    const message = write('classes', names.length === 0 ? null : names);
    setRefused(message);
    if (message === '') setDraft(undefined);
  };
  return (
    <div className="bd-field bd-author-field" data-attr="classes">
      <div className="bd-field-head">
        <label className="bd-field-label" htmlFor={id}>
          {t('inspector.classes.label')}
        </label>
      </div>
      <Input
        id={id}
        className="bd-code"
        value={shown}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-invalid={problem !== ''}
        aria-describedby={problem !== '' ? `${id}-error` : `${id}-hint`}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefused('');
        }}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply();
        }}
      />
      <Problems
        id={`${id}-error`}
        title={t('inspector.css.error')}
        list={problem === '' ? [] : [problem]}
      />
      <p className="bd-field-hint" id={`${id}-hint`}>
        {interpolate(t('inspector.classes.hint'), { max: MAX_CLASSES })}
      </p>
    </div>
  );
}

interface AttrRow {
  readonly key: number;
  readonly name: string;
  readonly value: string;
}

const canonical = (record: Readonly<Record<string, string>>): string =>
  JSON.stringify(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The record the rows stand for (rows without a name are ignored), or the first problem. */
function recordOf(
  rows: readonly AttrRow[],
  duplicate: string,
):
  | { readonly ok: true; readonly value: Record<string, string> }
  | { readonly ok: false; readonly error: string } {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name === '') continue;
    if (Object.hasOwn(out, name)) return { ok: false, error: `${duplicate}: ${name}` };
    Object.defineProperty(out, name, {
      value: row.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  const checked = checkAttributes(out);
  return checked.ok ? { ok: true, value: out } : { ok: false, error: checked.error };
}

/** HTML attributes of the block as name and value rows; a row applies once its name and value are valid. */
export function AttributesField({ node, disabled }: FieldProps) {
  const t = useT();
  const id = useId();
  const write = useWriteAttr(node.id);
  const counter = useRef(0);
  const fromNode = (): AttrRow[] =>
    Object.entries(node.attributes ?? {}).map(([name, value]) => ({
      key: counter.current++,
      name,
      value,
    }));
  const [rows, setRows] = useState<readonly AttrRow[]>(fromNode);
  const [refused, setRefused] = useState('');
  const storedKey = canonical(node.attributes ?? {});
  const parsed = recordOf(rows, t('inspector.attributes.duplicate'));
  const problem = !parsed.ok ? parsed.error : refused;

  // An undo or a redo changes the stored attributes under the rows: show what is stored.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the stored value resets the rows
  useEffect(() => {
    const now = recordOf(rows, '');
    if (!now.ok || canonical(now.value) !== storedKey) {
      setRows(fromNode());
      setRefused('');
    }
  }, [storedKey]);

  const commit = (next: readonly AttrRow[]) => {
    const record = recordOf(next, t('inspector.attributes.duplicate'));
    if (!record.ok) return;
    if (canonical(record.value) === storedKey) return;
    const message = write(
      'attributes',
      Object.keys(record.value).length === 0 ? null : record.value,
    );
    setRefused(message);
  };
  const edit = (key: number, patch: Partial<Pick<AttrRow, 'name' | 'value'>>) => {
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setRefused('');
  };
  return (
    <div className="bd-field bd-author-field" data-attr="attributes">
      <ul className="bd-author-attrs">
        {rows.map((row) => (
          <li key={row.key} className="bd-author-attr">
            <Input
              className="bd-code"
              aria-label={t('inspector.attributes.name')}
              placeholder="data-id"
              value={row.name}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => edit(row.key, { name: event.target.value })}
              onBlur={() => commit(rows)}
            />
            <Input
              className="bd-code"
              aria-label={t('inspector.attributes.value')}
              value={row.value}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => edit(row.key, { value: event.target.value })}
              onBlur={() => commit(rows)}
            />
            <IconButton
              variant="ghost"
              icon="trash-2"
              label={t('inspector.attributes.remove')}
              disabled={disabled}
              onClick={() => {
                const next = rows.filter((other) => other.key !== row.key);
                setRows(next);
                commit(next);
              }}
            />
          </li>
        ))}
      </ul>
      <Problems
        id={`${id}-error`}
        title={t('inspector.attributes.error')}
        list={problem === '' ? [] : [problem]}
      />
      <div className="bd-author-actions">
        <Button
          variant="ghost"
          disabled={disabled || rows.length >= MAX_ATTRIBUTES}
          onClick={() => setRows([...rows, { key: counter.current++, name: '', value: '' }])}
        >
          {t('inspector.attributes.add')}
        </Button>
      </div>
      <p className="bd-field-hint">{t('inspector.attributes.hint')}</p>
    </div>
  );
}

/** What the Advanced tab says while the host has not enabled author code: a quiet note, no fields. */
export function AuthorOffNote({ held }: { readonly held: boolean }) {
  const t = useT();
  return (
    <div className="bd-author-off" data-state="author-off">
      <p className="bd-field-hint">{t('inspector.author.off')}</p>
      {held ? <p className="bd-field-hint">{t('inspector.author.offHeld')}</p> : null}
    </div>
  );
}
