import { authorCodeEnabled, type HostCapabilities } from '../../author/capabilities.ts';
import { sanitizeHtmlToString } from '../../author/html.ts';
import { err, ok, type Result } from '../../result/result.ts';
import type { PropDef } from '../../schema/kinds/index.ts';
import type { Value } from '../../values/types.ts';
import { type CommandError, commandError } from '../errors.ts';

// The one place the command handlers decide what an author-HTML prop (`p.textarea({ format:
// 'html' })`, ADR-026) needs: the host capability to write it, and the sanitised form to store.
// `node.setProp`, `node.insert` and `node.wrap` all go through it, so a prop cannot be written
// along a path that skips either step.

/** Whether `def` holds author HTML. */
export function isHtmlProp(def: PropDef | undefined): boolean {
  return def?.kind === 'textarea' && def.format === 'html';
}

/** Refuses writing an author-HTML prop unless the host sets `capabilities.authorCode`. */
export function requireHtmlCapability(
  def: PropDef | undefined,
  capabilities: HostCapabilities | null | undefined,
): Result<void, CommandError> {
  if (!isHtmlProp(def) || authorCodeEnabled(capabilities)) return ok(undefined);
  return err(
    commandError('command.author-code-not-permitted', 'This editor is not allowed to write HTML.'),
  );
}

/** An HTML prop's value with every static text (and translation) reduced to its sanitised form. */
export function sanitizedHtmlValue(value: Value): Value {
  if (value.kind !== 'static' || typeof value.value !== 'string') return value;
  const l10n =
    value.l10n === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(value.l10n).map(([code, text]) => [
            code,
            typeof text === 'string' ? sanitizeHtmlToString(text) : text,
          ]),
        );
  return {
    ...value,
    value: sanitizeHtmlToString(value.value),
    ...(l10n !== undefined ? { l10n } : {}),
  } as Value;
}
