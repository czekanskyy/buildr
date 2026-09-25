import type { Diagnostic } from '@buildr/core';
import { useEffect, useState } from 'react';
import { type MessageKey, useT } from '../messages/index.tsx';
import {
  type PublishPolicy,
  publishGate,
  SEVERITY_ICON,
  useIssues,
} from '../panels/issues/index.ts';
import { type PublishOutcome, usePersistence, usePersistenceState } from '../persistence/index.ts';
import { useEditor, useEditorState } from '../store/index.ts';
import { Button, Dialog, Icon } from '../ui/index.ts';

export interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** `block` refuses to publish while errors exist; `warn` (the default) only says so. */
  readonly policy?: PublishPolicy | undefined;
  readonly canvasDiagnostics?: readonly Diagnostic[] | undefined;
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
  const { open, onOpenChange, policy, canvasDiagnostics, onPublished } = props;
  const t = useT();
  const store = useEditor();
  const persistence = usePersistence();
  const readOnly = useEditorState((state) => state.readOnly);
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
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('publish.title')}
      description={t('publish.description')}
      footer={
        <Button
          variant="primary"
          disabled={gate.blocked || readOnly || working || done || status === 'conflict'}
          onClick={() => void publish()}
        >
          {working ? t('publish.working') : t('toolbar.publish')}
        </Button>
      }
    >
      <p className="bd-publish-notice">{t('publish.notice')}</p>
      <ul className="bd-publish-summary" aria-label={t('publish.summary')}>
        {(['error', 'warning', 'info'] as const).map((severity) => (
          <li key={severity} className="bd-publish-badge" data-severity={severity}>
            <Icon name={SEVERITY_ICON[severity]} />
            <span aria-hidden="true">{gate.counts[severity]}</span>
            <span className="bd-visually-hidden">
              {t(`publish.count.${severity}`).replace('{count}', String(gate.counts[severity]))}
            </span>
          </li>
        ))}
      </ul>
      {gate.blocked ? (
        <p role="alert" className="bd-publish-blocked">
          {t(gate.reason === 'blocking' ? 'publish.blocked.corrupt' : 'publish.blocked.errors')}
        </p>
      ) : gate.counts.error + gate.counts.warning > 0 ? (
        <p className="bd-field-hint">{t('publish.warn')}</p>
      ) : null}
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
