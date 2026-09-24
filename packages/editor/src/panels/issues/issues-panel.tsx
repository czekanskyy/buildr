import type { Diagnostic } from '@buildr/core';
import type { Command } from '@buildr/core/commands';
import { useMemo, useState } from 'react';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { useEditor, useEditorState, useLocaleState } from '../../store/index.ts';
import { Button } from '../../ui/index.ts';
import {
  collectIssues,
  countIssues,
  filterIssues,
  groupMissingTranslations,
  type IssueItem,
  type SeverityFilter,
} from './collect.ts';

export interface IssuesPanelProps {
  /** What the canvas reported; the host keeps them from the protocol's `diagnostics` messages. */
  readonly canvasDiagnostics?: readonly Diagnostic[] | undefined;
}

/** Everything the checks found, as one list: validation, accessibility and the canvas. */
export function useIssues(canvasDiagnostics?: readonly Diagnostic[]): IssueItem[] {
  const doc = useEditorState((state) => state.doc);
  const validation = useEditorState((state) => state.validation);
  return useMemo(
    () =>
      collectIssues({
        doc,
        validation: validation?.issues,
        a11y: validation?.a11y,
        canvas: canvasDiagnostics,
      }),
    [doc, validation, canvasDiagnostics],
  );
}

const FILTERS: readonly { filter: SeverityFilter; key: MessageKey }[] = [
  { filter: 'all', key: 'issues.filter.all' },
  { filter: 'error', key: 'issues.filter.error' },
  { filter: 'warning', key: 'issues.filter.warning' },
  { filter: 'info', key: 'issues.filter.info' },
];

const SOURCE_KEY: Record<IssueItem['source'], MessageKey> = {
  validation: 'issues.source.validation',
  a11y: 'issues.source.a11y',
  canvas: 'issues.source.canvas',
};

/**
 * The Issues panel (docs/editor.md#issues-and-publishing): the findings of validation, the
 * accessibility rules and the canvas, filterable by severity. Choosing one selects the node it is
 * about; a finding with an unambiguous repair offers it as a button that runs it as a command.
 */
export function IssuesPanel({ canvasDiagnostics }: IssuesPanelProps) {
  const t = useT();
  const store = useEditor();
  const readOnly = useEditorState((state) => state.readOnly);
  const checked = useEditorState((state) => state.validation !== undefined);
  const items = useIssues(canvasDiagnostics);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [failed, setFailed] = useState<string | undefined>();
  const counts = countIssues(items);
  const shown = filterIssues(items, filter);
  const { rest, groups } = groupMissingTranslations(shown);
  const config = useLocaleState((state) => state.config);

  const fix = (item: IssueItem) => {
    if (item.fix === undefined) return;
    const result = store.dispatch(item.fix as Command, { label: item.message });
    setFailed(result.ok ? undefined : item.key);
  };

  const row = (item: IssueItem) => (
    <li key={item.key} className="bd-issue" data-severity={item.severity}>
      <button
        type="button"
        className="bd-issue-target"
        disabled={item.nodeId === undefined}
        onClick={() => {
          if (item.nodeId !== undefined) store.select(item.nodeId);
        }}
      >
        <span className="bd-issue-severity">{t(`issues.filter.${item.severity}`)}</span>
        <span className="bd-issue-message">{item.message}</span>
        <span className="bd-issue-source">
          {t(SOURCE_KEY[item.source])} · {item.code}
        </span>
      </button>
      {item.help !== undefined ? <p className="bd-issue-help">{item.help}</p> : null}
      {item.fix !== undefined ? (
        <Button disabled={readOnly} onClick={() => fix(item)}>
          {t('issues.fix')}
        </Button>
      ) : null}
      {failed === item.key ? (
        <p role="alert" className="bd-issue-error">
          {t('issues.fix.failed')}
        </p>
      ) : null}
    </li>
  );

  return (
    <section className="bd-issues" aria-label={t('issues.title')}>
      <h2 className="bd-panel-title">{t('issues.title')}</h2>
      <fieldset className="bd-issues-filters" aria-label={t('issues.filter')}>
        {FILTERS.map((entry) => (
          <Button
            key={entry.filter}
            variant="ghost"
            aria-pressed={filter === entry.filter}
            onClick={() => setFilter(entry.filter)}
          >
            {t(entry.key)} ({counts[entry.filter]})
          </Button>
        ))}
      </fieldset>
      {!checked ? <p className="bd-field-hint">{t('issues.pending')}</p> : null}
      {checked && shown.length === 0 ? <p className="bd-field-hint">{t('issues.empty')}</p> : null}
      {rest.length > 0 ? <ul className="bd-issues-list">{rest.map(row)}</ul> : null}
      {groups.map((group) => (
        <details key={group.locale} className="bd-issues-group" data-locale={group.locale} open>
          <summary>
            {t('issues.missingTranslations')}: {config.intl[group.locale] ?? group.locale} (
            {group.items.length})
          </summary>
          <ul className="bd-issues-list">{group.items.map(row)}</ul>
        </details>
      ))}
    </section>
  );
}
