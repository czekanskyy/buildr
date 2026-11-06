import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useT } from '../messages/index.tsx';
import { type DocumentAdapter, type DocumentRef, usePersistence } from '../persistence/index.ts';
import { Button } from '../ui/index.ts';
import { preparePreview } from './prepare.ts';

/**
 * The preview frame's sandbox. `allow-same-origin` is kept only for a preview served from the
 * editor's own origin (the playground's `/preview` reads the draft from `sessionStorage`, which a
 * sandboxed, opaque origin cannot). A preview on another origin has its own storage and needs no
 * access to the editor's, so the flag is left out; with both `allow-scripts` and
 * `allow-same-origin` a same-origin page could otherwise remove its own sandbox.
 */
export function previewSandbox(url: string, base?: string): string {
  const flags = ['allow-scripts', 'allow-forms', 'allow-popups'];
  try {
    const here = base ?? globalThis.location?.href;
    if (here !== undefined && new URL(url, here).origin === new URL(here).origin) {
      flags.splice(1, 0, 'allow-same-origin');
    }
  } catch {
    // An unparseable URL is treated as foreign: no same-origin access.
  }
  return flags.join(' ');
}

export interface PreviewOverlayProps {
  readonly url: string;
  readonly onExit: () => void;
}

/** The page as visitors get it, over the whole editor; Escape or the button leaves it. */
export function PreviewOverlay({ url, onExit }: PreviewOverlayProps) {
  const t = useT();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
  return (
    <div className="bd-preview" role="dialog" aria-modal="true" aria-label={t('preview.title')}>
      <div className="bd-preview-bar">
        <span>{t('preview.title')}</span>
        <Button variant="primary" onClick={onExit} autoFocus>
          {t('preview.exit')}
        </Button>
      </div>
      <iframe
        className="bd-preview-frame"
        title={t('preview.frame')}
        src={url}
        sandbox={previewSandbox(url)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export interface UsePreviewOptions {
  readonly adapter: Pick<DocumentAdapter, 'previewUrl'>;
  readonly docRef: DocumentRef;
  /** `overlay` (default) shows the page inside the editor, `tab` opens a new browser tab. */
  readonly target?: 'overlay' | 'tab' | undefined;
  /** Opens a tab; `window.open` unless a test gives another. */
  readonly open?: ((url: string) => void) | undefined;
}

export interface UsePreview {
  /** For the toolbar's `onPreview`. */
  readonly preview: () => void;
  /** Render this somewhere in the shell. */
  readonly overlay: ReactNode;
  /** Why the last attempt failed, as a message for a live region; empty when it did not. */
  readonly error: string;
}

/** Saves, then shows the preview (docs/editor.md#preview). */
export function usePreview(options: UsePreviewOptions): UsePreview {
  const { adapter, docRef, target = 'overlay', open } = options;
  const t = useT();
  const controller = usePersistence();
  const [url, setUrl] = useState<string | undefined>();
  const [error, setError] = useState('');

  const preview = useCallback(() => {
    setError('');
    void preparePreview(controller, adapter, docRef).then((result) => {
      if (!result.ok) {
        setError(t(result.reason === 'unsaved' ? 'preview.unsaved' : 'preview.unsafe'));
        return;
      }
      if (target === 'tab') {
        if (open !== undefined) open(result.url);
        else window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setUrl(result.url);
      }
    });
  }, [controller, adapter, docRef, target, open, t]);

  const exit = useCallback(() => setUrl(undefined), []);
  return {
    preview,
    error,
    overlay: url === undefined ? null : <PreviewOverlay url={url} onExit={exit} />,
  };
}
