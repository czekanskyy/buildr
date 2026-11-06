import type { Diagnostic } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { useMemo, useState } from 'react';
import { useManifest, useSourceManifest } from '../../app/manifest.tsx';
import { useStageSlots } from '../../app/stage-slots.tsx';
import { localizeIssue } from '../../i18n/diagnostics.ts';
import { useT, useUiLocale } from '../../messages/index.tsx';
import { useEditor, useEditorState, useLocaleState } from '../../store/index.ts';
import { Button, Icon, IconButton, type IconName } from '../../ui/index.ts';
import {
  collectIssues,
  groupMissingTranslations,
  type IssueItem,
  type IssueSeverity,
} from './collect.ts';
import { issuePath } from './path.ts';

export interface IssuesPanelProps {
  /** What the canvas reported; the host keeps them from the protocol's `diagnostics` messages. */
  readonly canvasDiagnostics?: readonly Diagnostic[] | undefined;
}

/** Everything the checks found, as one list: validation, accessibility and the canvas. */
export function useIssues(canvasDiagnostics?: readonly Diagnostic[]): IssueItem[] {
  const doc = useEditorState((state) => state.doc);
  const validation = useEditorState((state) => state.validation);
  const intl = useLocaleState((state) => state.config.intl);
  const t = useT();
  const uiLocale = useUiLocale();
  const manifest = useManifest();
  const source = useSourceManifest();
  return useMemo(
    () =>
      collectIssues({
        doc,
        validation: validation?.issues,
        a11y: validation?.a11y,
        canvas: canvasDiagnostics,
      }).map((item) => localizeIssue(item, { t, uiLocale, doc, manifest, source, intl })),
    [doc, validation, canvasDiagnostics, t, uiLocale, manifest, source, intl],
  );
}

export const SEVERITY_ICON: Readonly<Record<IssueSeverity, IconName>> = {
  error: 'circle-alert',
  warning: 'triangle-alert',
  info: 'info',
};

/**
 * The content of the Issues drawer (docs/editor.md#issues-and-publishing): a header with the count
 * and a close button, then one 40px row per finding (worst first) with its "Block › Block" path.
 * Choosing a row selects the node it is about; a finding with an unambiguous repair offers it as a
 * button that runs it as a command. The drawer itself (placement, height) belongs to the layout.
 */
export function IssuesPanel({ canvasDiagnostics }: IssuesPanelProps) {
  const t = useT();
  const store = useEditor();
  const slots = useStageSlots();
  const readOnly = useEditorState((state) => state.readOnly);
  const checked = useEditorState((state) => state.validation !== undefined);
  const items = useIssues(canvasDiagnostics);
  const [failed, setFailed] = useState<string | undefined>();
  const config = useLocaleState((state) => state.config);
  const doc = useEditorState((state) => state.doc);
  const manifest = useManifest();

  const fix = (item: IssueItem) => {
    if (item.fix === undefined) return;
    const result = store.dispatch(item.fix as Command, { label: item.message });
    setFailed(result.ok ? undefined : item.key);
  };

  const row = (item: IssueItem) => {
    const path =
      item.nodeId === undefined ? t('issues.nodeless') : issuePath(doc, manifest, item.nodeId);
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
          <Icon
            name={SEVERITY_ICON[item.severity]}
            label={t(`issues.filter.${item.severity}`)}
            className="bd-issue-severity"
          />
          <span className="bd-issue-message">{item.message}</span>
          <small className="bd-issue-path">{path}</small>
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

  const { rest, groups } = groupMissingTranslations(items);
  return (
    <div className="bd-issues-panel">
      <header className="bd-issues-head">
        <Icon name="triangle-alert" className="bd-issues-head-icon" />
        <h2 className="bd-issues-title">{t('issues.drawer')}</h2>
        <span className="bd-chip bd-issues-count">{items.length}</span>
        {slots !== undefined ? (
          <IconButton
            size="sm"
            variant="ghost"
            icon="x"
            label={t('issues.drawer.close')}
            onClick={() => slots.setIssuesOpen(false)}
          />
        ) : null}
      </header>
      {!checked ? (
        <p className="bd-issues-pending" role="status">
          {t('issues.pending')}
        </p>
      ) : null}
      {checked && items.length === 0 ? (
        <div className="bd-issue bd-issue-ok">
          <Icon name="circle-check" className="bd-issue-ok-icon" />
          <span className="bd-issue-message">{t('issues.allGood')}</span>
        </div>
      ) : null}
      {rest.length > 0 ? <ul className="bd-issues-list">{rest.map(row)}</ul> : null}
      {groups.map((group) => (
        <details key={group.locale} className="bd-issues-group" data-locale={group.locale}>
          <summary>
            {t('issues.missingTranslations')}: {config.intl[group.locale] ?? group.locale} (
            {group.items.length})
          </summary>
          <ul className="bd-issues-list">{group.items.map(row)}</ul>
        </details>
      ))}
    </div>
  );
}
