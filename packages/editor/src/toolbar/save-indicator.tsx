import { useT } from '../messages/index.tsx';
import { usePersistence, usePersistenceState } from '../persistence/index.ts';
import { useEditorState } from '../store/index.ts';
import { Button, Icon, type IconName } from '../ui/index.ts';

const STATUS_ICONS: Readonly<Record<string, IconName>> = {
  clean: 'check',
  dirty: 'circle',
  saving: 'loader-circle',
  error: 'triangle-alert',
  conflict: 'triangle-alert',
};

/**
 * The save status as an icon and a short text (the same messages as `SaveStatus`). When the row is
 * tight the text is visually hidden; it stays the status region's content.
 */
export function SaveIndicator({ compact = false }: { readonly compact?: boolean }) {
  const t = useT();
  const controller = usePersistence();
  const status = usePersistenceState((state) => state.status);
  const error = usePersistenceState((state) => state.error);
  const readOnly = useEditorState((state) => state.readOnly);
  const text = readOnly
    ? t('save.readOnly')
    : status === 'error' && error?.kind === 'invalid'
      ? t('save.invalid')
      : t(`save.${status}`);
  const icon: IconName = readOnly ? 'lock' : (STATUS_ICONS[status] ?? 'circle');
  return (
    <span
      className="bd-save-status"
      data-status={readOnly ? 'readOnly' : status}
      data-compact={compact}
      role="status"
      title={text}
    >
      <Icon name={icon} />
      <span className={compact ? 'bd-visually-hidden' : undefined}>{text}</span>
      {!readOnly && (status === 'dirty' || status === 'error') && (
        <Button variant="ghost" onClick={() => void controller.saveNow()}>
          {t('save.now')}
        </Button>
      )}
    </span>
  );
}
