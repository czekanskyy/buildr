import { sanitizeHtml, serializeHtml, type TextareaPropDef } from '@next-buildr/core';
import { useId, useMemo, useState } from 'react';
import { useT } from '../../../messages/index.tsx';
import { useEditor } from '../../../store/index.ts';
import type { ControlProps } from './types.ts';

/**
 * A textarea prop. `format: 'html'` marks author HTML (ADR-026): a code field that needs the host's
 * `authorCode` capability. Core sanitises the value when it is written, so what is typed is kept as
 * a draft and written when the field loses focus, with a preview of what the sanitiser keeps.
 */
export function TextareaControl(props: ControlProps<TextareaPropDef>) {
  if (props.def.format === 'html') return <HtmlControl {...props} />;
  const { id, def, label, describedBy, value, disabled, onChange } = props;
  return (
    <textarea
      id={id}
      className="bd-input bd-textarea"
      rows={4}
      value={typeof value === 'string' ? value : def.default}
      maxLength={def.maxLength}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function HtmlControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<TextareaPropDef>) {
  const t = useT();
  const store = useEditor();
  const noteId = useId();
  const permitted = store.authorCode;
  const stored = typeof value === 'string' ? value : def.default;
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shown = draft ?? stored;
  const result = useMemo(() => sanitizeHtml(shown), [shown]);
  const apply = () => {
    if (draft === undefined) return;
    if (draft !== stored) onChange(draft);
    setDraft(undefined);
  };
  return (
    <div className="bd-html-field" data-state={permitted ? 'on' : 'off'}>
      <textarea
        id={id}
        className="bd-input bd-textarea bd-code"
        rows={8}
        value={shown}
        maxLength={def.maxLength}
        disabled={disabled || !permitted}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-label={label}
        aria-describedby={[describedBy, noteId].filter(Boolean).join(' ')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      <div id={noteId} className="bd-html-note">
        {permitted ? (
          <>
            <p className="bd-field-hint">{t('inspector.text.html.hint')}</p>
            {result.removed.length === 0 ? (
              shown.trim() === '' ? null : (
                <p className="bd-field-hint" role="status">
                  {t('inspector.text.html.clean')}
                </p>
              )
            ) : (
              <div className="bd-author-problems" role="status" data-kind="removed">
                <strong>{t('inspector.text.html.removed')}</strong>
                <ul>
                  {[...new Set(result.removed)].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {shown.trim() === '' ? null : (
              <>
                <span className="bd-flabel">{t('inspector.text.html.preview')}</span>
                <pre className="bd-code-preview">
                  <code>{serializeHtml(result.nodes)}</code>
                </pre>
              </>
            )}
          </>
        ) : (
          <p className="bd-field-hint">{t('inspector.text.html.off')}</p>
        )}
      </div>
    </div>
  );
}
