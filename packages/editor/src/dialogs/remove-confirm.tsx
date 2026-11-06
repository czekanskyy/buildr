import type { RemoveRequest } from '../app/contracts.ts';
import { componentMeta, useManifest } from '../app/manifest.tsx';
import { interpolate, usePlural, useT } from '../messages/index.tsx';
import { detectPlatform, displayCombo } from '../shortcuts/keys.ts';
import { descendantCount } from '../shortcuts/navigation.ts';
import { useShortcutHint } from '../shortcuts/shortcuts.tsx';
import { useEditorState } from '../store/index.ts';
import { Button, Dialog } from '../ui/index.ts';

export interface RemoveConfirmProps {
  /** The pending removal; `null` keeps the dialog closed. */
  readonly request: RemoveRequest | null;
  readonly onConfirm: (request: RemoveRequest) => void;
  readonly onCancel: () => void;
}

/**
 * The confirmation before removing a node that has blocks inside it (an `alert` dialog). It names
 * the node when one is selected, says how many blocks go with it, and returns focus to the opener
 * when it closes.
 */
export function RemoveConfirm({ request, onConfirm, onCancel }: RemoveConfirmProps) {
  const t = useT();
  const plural = usePlural();
  const manifest = useManifest();
  const doc = useEditorState((state) => state.doc);
  const undoHint = useShortcutHint('edit.undo') ?? displayCombo('mod+z', detectPlatform());
  const ids = request?.ids ?? [];
  const [single] = ids;
  const many = ids.length > 1;
  const node = !many && single !== undefined ? doc.nodes[single] : undefined;
  const name = node?.name ?? componentMeta(manifest, node?.type ?? '')?.label ?? node?.type ?? '';
  const section = node !== undefined && doc.nodes[doc.root]?.slots?.['default']?.includes(node.id);
  const title = many
    ? plural('dialog.delete.titleMany', ids.length)
    : interpolate(t(section === true ? 'dialog.delete.title' : 'dialog.delete.titleBlock'), {
        name,
      });
  const contained = descendantCount(doc, ids);
  const description = interpolate(
    plural(
      section === true ? 'dialog.delete.contains' : 'dialog.delete.containsBlock',
      Math.max(contained, 1),
    ),
    {
      shortcut: undoHint,
    },
  );
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      alert
      tone="danger"
      icon="trash-2"
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onCancel}>{t('dialog.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (request !== null) onConfirm(request);
            }}
          >
            {t(section === true ? 'dialog.delete.confirmSection' : 'dialog.delete.confirmBlock')}
          </Button>
        </>
      }
    />
  );
}
