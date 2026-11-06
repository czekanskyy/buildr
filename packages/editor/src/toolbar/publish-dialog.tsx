import type { Diagnostic } from '@next-buildr/core';
import { useEffect, useId, useRef, useState } from 'react';
import { useManifest } from '../app/manifest.tsx';
import { useStageSlots } from '../app/stage-slots.tsx';
import { interpolate, type MessageKey, usePlural, useT } from '../messages/index.tsx';
import {
  issuePath,
  type PublishPolicy,
  publishGate,
  SEVERITY_ICON,
  useIssues,
} from '../panels/issues/index.ts';
import { type PublishOutcome, usePersistence, usePersistenceState } from '../persistence/index.ts';
import { useEditor, useEditorState } from '../store/index.ts';
import { Button, Dialog, Icon, Tooltip } from '../ui/index.ts';

export interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** `block` refuses to publish while errors exist; `warn` (the default) only says so. */
  readonly policy?: PublishPolicy | undefined;
  readonly canvasDiagnostics?: readonly Diagnostic[] | undefined;
  /** The page's name and its public address, for the "visible at" line; the line is left out without an address. */
  readonly pageName?: string | undefined;
  readonly address?: string | undefined;
  /** Called after the backend accepted the publication. */
  readonly onPublished?: (() => void) | undefined;
}

const FAILURE_KEY: Record<Exclude<PublishOutcome, { ok: true }>['kind'], MessageKey> = {
  conflict: 'publish.failed.conflict',
  invalid: 'publish.failed.invalid',
  unsaved: 'publish.failed.unsaved',
  network: 'publish.failed.network',
};

/**
 * The publish dialog (docs/editor.md#issues-and-publishing): re-runs the checks, summarises what
 * they found, applies the publish policy, says that publishing replaces the live page as a whole,
 * and publishes after saving whatever is unsaved (`PersistenceController.publish`).
 */
export function PublishDialog(props: PublishDialogProps) {
  const { open, onOpenChange, policy, canvasDiagnostics, onPublished, pageName, address } = props;
  const primary = useRef<HTMLButtonElement>(null);
  const scheduleReason = useId();
  const t = useT();
  const plural = usePlural();
  const slots = useStageSlots();
  const manifest = useManifest();
  const store = useEditor();
  const persistence = usePersistence();
  const readOnly = useEditorState((state) => state.readOnly);
  const doc = useEditorState((state) => state.doc);
  const status = usePersistenceState((state) => state.status);
  const items = useIssues(canvasDiagnostics);
  const gate = publishGate(items, policy);
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | undefined>();

  // The checks run a moment after the last edit; the dialog must not judge an older document.
  useEffect(() => {
    if (!open) return;
    setOutcome(undefined);
    store.validateNow();
  }, [open, store]);

  const publish = async () => {
    setWorking(true);
    setOutcome(undefined);
    store.validateNow();
    const result = await persistence.publish();
    setWorking(false);
    setOutcome(result);
    if (result.ok) onPublished?.();
  };

  const done = outcome?.ok === true;
  const counts = (['error', 'warning', 'info'] as const)
    .filter((severity) => gate.counts[severity] > 0)
    .map((severity) => plural(`issues.count.${severity}`, gate.counts[severity]))
    .join(', ');
  const showIssues = () => {
    slots?.setIssuesOpen(true);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      icon="send"
      initialFocus={primary}
      title={t('dialog.publish.title')}
      description={t('publish.description')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('dialog.cancel')}</Button>
          <Button
            ref={primary}
            variant="primary"
            disabled={gate.blocked || readOnly || working || done || status === 'conflict'}
            onClick={() => void publish()}
          >
            {working ? t('publish.working') : t('dialog.publish.confirm')}
          </Button>
        </>
      }
    >
      {address === undefined ? null : (
        <p className="bd-publish-address">
          {interpolate(t('dialog.publish.visibleAt'), {
            name: pageName ?? '',
            address,
          })}
        </p>
      )}
      <p className="bd-publish-notice">{t('publish.notice')}</p>
      <ul
        className="bd-publish-list"
        aria-label={t('publish.summary')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
        tabIndex={0}
      >
        {items.length === 0 ? (
          <li className="bd-publish-row" data-severity="ok">
            <Icon name="circle-check" className="bd-publish-row-icon" />
            <span className="bd-publish-row-text">{t('issues.allGood')}</span>
          </li>
        ) : (
          items.map((item) => {
            const path = item.nodeId === undefined ? '' : issuePath(doc, manifest, item.nodeId);
            const content = (
              <>
                <Icon
                  name={SEVERITY_ICON[item.severity]}
                  label={t(`issues.filter.${item.severity}`)}
                  className="bd-publish-row-icon"
                />
                <span className="bd-publish-row-text">{item.message}</span>
                {path === '' ? null : <small className="bd-publish-row-path">{path}</small>}
              </>
            );
            return (
              <li key={item.key} className="bd-publish-row" data-severity={item.severity}>
                {slots === undefined ? (
                  content
                ) : (
                  <button type="button" className="bd-publish-row-button" onClick={showIssues}>
                    {content}
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>
      {gate.blocked ? (
        <p role="alert" className="bd-publish-blocked">
          {t(gate.reason === 'blocking' ? 'publish.blocked.corrupt' : 'publish.blocked.errors')}
        </p>
      ) : counts !== '' ? (
        <p className="bd-publish-counts">
          {gate.counts.error > 0
            ? `${t('publish.warn')} (${counts})`
            : interpolate(t('dialog.publish.warningsDontBlock'), { issues: counts })}
        </p>
      ) : null}
      <fieldset className="bd-publish-when" aria-label={t('dialog.publish.when')}>
        <button type="button" aria-pressed="true" className="bd-publish-option">
          <b>{t('dialog.publish.now')}</b>
          <span>{t('dialog.publish.nowHint')}</span>
        </button>
        {/* Scheduling needs adapter support that does not exist yet: shown, not usable. */}
        <Tooltip content={t('dialog.publish.soon')}>
          <button
            type="button"
            aria-pressed="false"
            aria-disabled="true"
            aria-describedby={scheduleReason}
            className="bd-publish-option"
            data-unavailable=""
          >
            <b>{t('dialog.publish.schedule')}</b>
            <span>{t('dialog.publish.scheduleHint')}</span>
            <small id={scheduleReason} className="bd-publish-option-reason">
              {t('dialog.publish.scheduleUnavailable')}
            </small>
          </button>
        </Tooltip>
      </fieldset>
      {status === 'conflict' ? (
        <p role="alert" className="bd-publish-blocked">
          {t('publish.failed.conflict')}
        </p>
      ) : null}
      {outcome !== undefined && !outcome.ok ? (
        <p role="alert" className="bd-publish-blocked">
          {t(FAILURE_KEY[outcome.kind])}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="bd-publish-done">
          {t('publish.done')}
        </p>
      ) : null}
    </Dialog>
  );
}
