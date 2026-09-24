// Public entry point of @buildr/editor: the standalone visual editor application.
// Depends only on @buildr/core - it drives a canvas (a real Next.js route running the
// real renderer) through the postMessage protocol; it never renders the document itself.
// Import '@buildr/editor/styles.css' once in the host.

export { BuilderEditor } from './app/builder-editor.tsx';
export type {
  BreakpointConfig,
  BuilderEditorProps,
  DocumentRef,
  EditorConfig,
  ResolvedEditorConfig,
} from './app/config.ts';
export { DEFAULT_BREAKPOINTS, resolveConfig } from './app/config.ts';
export type { EditorLayoutProps } from './app/layout.tsx';
export { EditorLayout } from './app/layout.tsx';
export * from './canvas-host/index.ts';
export type { MessageKey, Messages, Translate, UiLocale } from './messages/index.tsx';
export { createTranslator, MessagesProvider, UI_LOCALES, useT } from './messages/index.tsx';
export * from './panels/index.ts';
export * from './store/index.ts';
export * from './ui/index.ts';
