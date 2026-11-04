import type { MessageKey } from '../messages/index.tsx';
import { useT } from '../messages/index.tsx';
import { Dialog, Kbd } from '../ui/index.ts';
import { displayCombo, type Platform } from './keys.ts';
import type { ShortcutRegistry } from './registry.ts';

/** One row: a label and one or more key groups ("Ctrl C" / "Ctrl V"), each a list of key tokens. */
interface HelpRow {
  readonly label: MessageKey;
  readonly groups: readonly (readonly string[])[];
}

interface HelpGroup {
  readonly id: 'general' | 'selection' | 'edit' | 'view';
  readonly title: MessageKey;
  readonly rows: readonly HelpRow[];
}

/** The tokens of an action's first combination; `shift` is dropped before `?`, which already implies it. */
function tokensOf(registry: ShortcutRegistry, action: string): string[] | undefined {
  const combo = registry.keysFor(action)[0];
  if (combo === undefined) return undefined;
  const parts = combo.split('+');
  return parts.at(-1) === '?' ? ['?'] : parts;
}

/** The rows of the help dialog, from the registry (so overrides show) plus the canvas-only keys. */
function helpGroups(registry: ShortcutRegistry): HelpGroup[] {
  const row = (label: MessageKey, ...actions: string[]): HelpRow | undefined => {
    const groups = actions.map((action) => tokensOf(registry, action));
    return groups.every((group) => group !== undefined)
      ? { label, groups: groups as string[][] }
      : undefined;
  };
  const copyPaste = row('shortcut.copyPaste', 'edit.copy', 'edit.paste');
  const device1 = tokensOf(registry, 'ui.device1');
  const device: HelpRow | undefined =
    device1 === undefined
      ? undefined
      : { label: 'shortcut.device', groups: [[...device1, '2', '3']] };
  const defined = (rows: readonly (HelpRow | undefined)[]): HelpRow[] =>
    rows.filter((entry): entry is HelpRow => entry !== undefined);
  return [
    {
      id: 'general',
      title: 'shortcut.group.general',
      rows: defined([
        row('shortcut.save', 'file.save'),
        row('shortcut.undo', 'edit.undo'),
        row('shortcut.redo', 'edit.redo'),
        row('shortcut.findBlock', 'ui.findBlock'),
        row('shortcut.help', 'help.shortcuts'),
      ]),
    },
    {
      id: 'selection',
      title: 'shortcut.group.selection',
      rows: [
        { label: 'shortcut.selectBlock', groups: [['enter']] },
        ...defined([row('shortcut.selectParent', 'selection.clear')]),
        { label: 'shortcut.nextBlock', groups: [['tab']] },
        { label: 'shortcut.prevBlock', groups: [['shift', 'tab']] },
      ],
    },
    {
      id: 'edit',
      title: 'shortcut.group.edit',
      rows: defined([
        row('shortcut.duplicate', 'edit.duplicate'),
        row('shortcut.delete', 'edit.delete'),
        copyPaste,
        row('shortcut.moveUp', 'node.moveUp'),
        row('shortcut.moveDown', 'node.moveDown'),
      ]),
    },
    {
      id: 'view',
      title: 'shortcut.group.view',
      rows: defined([
        device,
        row('shortcut.togglePanels', 'ui.panels'),
        row('shortcut.guides', 'ui.guides'),
      ]),
    },
  ];
}

export interface ShortcutsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly registry: ShortcutRegistry;
  readonly platform: Platform;
}

/** The shortcuts dialog (`?`): four groups of rows, one `Kbd` per key, and the note for Mac users. */
export function ShortcutsDialog({ open, onOpenChange, registry, platform }: ShortcutsDialogProps) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('shortcut.title')}>
      <div className="bd-shortcut-help">
        {helpGroups(registry).map((group) => (
          <section key={group.id}>
            <h3>{t(group.title)}</h3>
            <dl>
              {group.rows.map((entry) => (
                <div key={entry.label} className="bd-shortcut-row">
                  <dt>{t(entry.label)}</dt>
                  <dd>
                    {entry.groups.map((keys, at) => (
                      <span key={keys.join('+')}>
                        {at > 0 ? ' / ' : ''}
                        {keys.map((token, index) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: a combination may repeat a token and never reorders
                          <Kbd key={`${token}-${index}`}>{displayCombo(token, platform)}</Kbd>
                        ))}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p>{t('shortcut.macNote')}</p>
      </div>
    </Dialog>
  );
}
