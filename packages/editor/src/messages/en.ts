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
  'editor.canvas.connecting': 'Connecting to the canvas…',
  'editor.canvas.frame': 'Page preview',
  'editor.canvas.reload': 'Reload canvas',
  'editor.canvas.error.timeout':
    'The canvas did not answer. Check its URL, its Content-Security-Policy (frame-ancestors) and the origins it allows.',
  'editor.canvas.error.manifest':
    'The canvas was built with other components than the editor. Rebuild the canvas or reload the editor.',
  'editor.canvas.error.protocol':
    'The canvas and the editor are different versions. Update them together.',
  'editor.canvas.error.canvas': 'The canvas stopped working.',
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
