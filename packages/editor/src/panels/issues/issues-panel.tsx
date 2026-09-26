import type { Diagnostic } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { useMemo, useState } from 'react';
import { componentMeta, useManifest } from '../../app/manifest.tsx';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { useEditor, useEditorState, useLocaleState } from '../../store/index.ts';
import { Button, ComponentIcon, Icon, type IconName } from '../../ui/index.ts';
import {
  collectIssues,
  countIssues,
  filterIssues,
  groupMissingTranslations,
  type IssueItem,
  type IssueSeverity,
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

const SEVERITIES: readonly IssueSeverity[] = ['error', 'warning', 'info'];

export const SEVERITY_ICON: Readonly<Record<IssueSeverity, IconName>> = {
  error: 'circle-alert',
  warning: 'triangle-alert',
  info: 'info',
};

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
  const config = useLocaleState((state) => state.config);
  const doc = useEditorState((state) => state.doc);
  const manifest = useManifest();

  const fix = (item: IssueItem) => {
    if (item.fix === undefined) return;
    const result = store.dispatch(item.fix as Command, { label: item.message });
    setFailed(result.ok ? undefined : item.key);
  };

  const row = (item: IssueItem) => {
    const node = item.nodeId === undefined ? undefined : doc.nodes[item.nodeId];
    const meta = node === undefined ? undefined : componentMeta(manifest, node.type);
    const owner =
      node === undefined ? t('issues.nodeless') : (node.name ?? meta?.label ?? node.type);
    return (
      <li key={item.key} className="bd-issue" data-severity={item.severity}>
        <button
          type="button"
          className="bd-issue-target"
          disabled={item.nodeId === undefined}
          onClick={() => {
            if (item.nodeId !== undefined) store.select(item.nodeId);
          }}
        >
          <span className="bd-issue-head">
            <Icon
              name={SEVERITY_ICON[item.severity]}
              label={t(`issues.filter.${item.severity}`)}
              className="bd-issue-severity"
            />
            {node !== undefined && <ComponentIcon meta={meta} className="bd-issue-component" />}
            <span className="bd-issue-owner">{owner}</span>
          </span>
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
  };

  const severitySection = (severity: IssueSeverity) => {
    const own = shown.filter((item) => item.severity === severity);
    if (own.length === 0) return null;
    const { rest, groups } = groupMissingTranslations(own);
    return (
      <section key={severity} className="bd-issues-severity" data-severity={severity}>
        <h3 className="bd-issues-heading">
          <Icon name={SEVERITY_ICON[severity]} />
          {t(`issues.group.${severity}`)} ({own.length})
        </h3>
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
  };

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
      {SEVERITIES.map(severitySection)}
    </section>
  );
}
