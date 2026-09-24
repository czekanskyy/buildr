/**
 * Every string the editor shows, English. The other catalogs are typed against these keys, so a
 * missing translation is a type error. No component writes a user-visible string of its own
 * (AGENTS.md): it asks `useT()`.
 */
export const en = {
  'editor.toolbar': 'Toolbar',
  'editor.leftPanel': 'Insert and layers',
  'editor.canvas': 'Canvas',
  'editor.inspector': 'Inspector',
  'editor.issues': 'Issues',
  'editor.breadcrumbs': 'Selection path',
  'editor.issues.show': 'Show issues',
  'editor.issues.hide': 'Hide issues',
  'editor.resize.left': 'Resize the left panel',
  'editor.resize.right': 'Resize the right panel',
  'ui.close': 'Close',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, string>>;
