import type { MessageKey } from '../messages/index.tsx';
import { normalizeCombo } from './keys.ts';

export interface ShortcutDef {
  readonly action: string;
  readonly label: MessageKey;
  readonly group: 'edit' | 'selection' | 'file' | 'help';
  /** Canonical combinations (`mod+z`); the first is the one the help dialog shows first. */
  readonly keys: readonly string[];
}

const def = (
  action: string,
  label: MessageKey,
  group: ShortcutDef['group'],
  ...keys: string[]
): ShortcutDef => ({ action, label, group, keys: keys.map(normalizeCombo) });

/** The shortcuts of the MVP (docs/editor.md#keyboard-shortcuts-pb-084). */
export const DEFAULT_SHORTCUTS: readonly ShortcutDef[] = [
  def('edit.undo', 'shortcut.undo', 'edit', 'mod+z'),
  def('edit.redo', 'shortcut.redo', 'edit', 'mod+shift+z', 'mod+y'),
  def('edit.copy', 'shortcut.copy', 'edit', 'mod+c'),
  def('edit.cut', 'shortcut.cut', 'edit', 'mod+x'),
  def('edit.paste', 'shortcut.paste', 'edit', 'mod+v'),
  def('edit.duplicate', 'shortcut.duplicate', 'edit', 'mod+d'),
  def('edit.delete', 'shortcut.delete', 'edit', 'delete', 'backspace'),
  def('node.moveUp', 'shortcut.moveUp', 'edit', 'alt+arrowup'),
  def('node.moveDown', 'shortcut.moveDown', 'edit', 'alt+arrowdown'),
  def('selection.all', 'shortcut.selectAll', 'selection', 'mod+a'),
  def('selection.clear', 'shortcut.clearSelection', 'selection', 'escape'),
  def('file.save', 'shortcut.save', 'file', 'mod+s'),
  def('help.shortcuts', 'shortcut.help', 'help', 'shift+?'),
];

/**
 * The map with the host's overrides applied (`config.shortcuts`, by action id): an override
 * replaces the action's combinations with that one; an empty string turns the action's shortcut
 * off. Overrides for unknown actions are ignored.
 */
export function applyOverrides(
  defaults: readonly ShortcutDef[],
  overrides: Readonly<Record<string, string>>,
): ShortcutDef[] {
  return defaults.map((shortcut) => {
    if (!Object.hasOwn(overrides, shortcut.action)) return shortcut;
    const combo = normalizeCombo(overrides[shortcut.action] ?? '');
    return { ...shortcut, keys: combo === '' ? [] : [combo] };
  });
}
