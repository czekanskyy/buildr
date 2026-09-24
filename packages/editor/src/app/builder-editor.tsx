import { useMemo } from 'react';
import { MessagesProvider } from '../messages/index.tsx';
import { type BuilderEditorProps, resolveConfig } from './config.ts';
import { EditorLayout } from './layout.tsx';

/**
 * The editor (docs/editor.md#layout-and-modules): `<BuilderEditor adapter manifest canvasUrl
 * documentRef config />`. It fills its container, so give the container a height. The panels are
 * added by the following tasks; the props are already the final mount API.
 */
export function BuilderEditor(props: BuilderEditorProps) {
  const config = useMemo(() => resolveConfig(props.config), [props.config]);
  return (
    <MessagesProvider locale={config.uiLocale}>
      <div
        className="buildr-editor"
        lang={config.uiLocale}
        {...(config.theme !== 'system' ? { 'data-theme': config.theme } : {})}
      >
        <EditorLayout />
      </div>
    </MessagesProvider>
  );
}
