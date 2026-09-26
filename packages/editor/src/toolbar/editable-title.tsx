import { useEffect, useRef, useState } from 'react';
import { useT } from '../messages/index.tsx';

export interface EditableTitleProps {
  readonly title: string;
  /** Saves a new name; it rejects when the backend refused, and the name then goes back. */
  readonly onRename: (title: string) => Promise<void>;
  readonly disabled?: boolean;
}

/** Longest name the backends take (`createDocumentRequestSchema` in the Payload contract). */
export const MAX_TITLE_LENGTH = 200;

/**
 * The page name as a field that looks like a heading: Enter or leaving it saves, Escape puts the
 * old name back, an empty name is not saved. The field grows with the name.
 */
export function EditableTitle({ title, onRename, disabled }: EditableTitleProps) {
  const t = useT();
  const [draft, setDraft] = useState(title);
  const editing = useRef(false);
  const cancelled = useRef(false);
  // A rename that came from elsewhere (a reload, another tab) replaces the text unless it is being typed.
  useEffect(() => {
    if (!editing.current) setDraft(title);
  }, [title]);

  const commit = () => {
    editing.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (next === '' || next === title) {
      setDraft(title);
      return;
    }
    setDraft(next);
    onRename(next).catch(() => setDraft(title));
  };

  return (
    <input
      className="bd-toolbar-title bd-title-input"
      value={draft}
      title={draft}
      size={Math.min(Math.max(draft.length, 8), 40)}
      maxLength={MAX_TITLE_LENGTH}
      disabled={disabled === true}
      aria-label={t('toolbar.title.rename')}
      autoComplete="off"
      spellCheck={false}
      onFocus={(event) => {
        editing.current = true;
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        else if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft(title);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
