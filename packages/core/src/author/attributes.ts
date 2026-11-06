import { err, ok, type Result } from '../result/result.ts';

// Node-level class names and HTML attributes (ADR-026). Both are author code: they are only
// written, and only rendered, when the host sets `capabilities.authorCode`. Whatever the host
// allows, the shapes below are fixed here: a class is one safe token that cannot collide with
// Buildr's own `b-` classes, and an attribute is a name from a short allowlist with a bounded,
// control-character-free value. Event handlers, `style`, `class`, `id` and URL-bearing attributes
// are not on the list.

export const MAX_CLASSES = 16;
export const MAX_CLASS_LENGTH = 64;
export const MAX_ATTRIBUTES = 16;
export const MAX_ATTRIBUTE_VALUE_LENGTH = 256;

const CLASS_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const DATA_NAME = /^data-[a-z][a-z0-9-]{0,48}$/;
const ARIA_NAME = /^aria-[a-z]{1,40}$/;
const PLAIN_NAMES: ReadonlySet<string> = new Set(['role', 'title', 'lang', 'dir', 'tabindex']);
const ROLE_VALUE = /^[a-z][a-z-]{0,39}$/;
const LANG_VALUE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;
/** Control characters, DEL, C1 and the Unicode line and paragraph separators. */
function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)
      return true;
  }
  return false;
}

/** Whether a class name is acceptable on its own (the `b-` prefix belongs to Buildr's scoped classes). */
export function isValidClassName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_CLASS_LENGTH &&
    CLASS_NAME.test(name) &&
    !name.startsWith('b-') &&
    !name.startsWith('buildr')
  );
}

/** Whether `name` may be set as an attribute (the value is checked separately). */
export function isAllowedAttributeName(name: string): boolean {
  // `data-b*` is Buildr's: the canvas reads `data-bi`, `data-bid` and `data-buildr-overlay`,
  // `-placeholder` and `-slot` as its own markers, and an author must not be able to forge them.
  if (name.startsWith('data-b')) return false;
  return DATA_NAME.test(name) || ARIA_NAME.test(name) || PLAIN_NAMES.has(name);
}

function attributeValueError(name: string, value: string): string | undefined {
  if (value.length > MAX_ATTRIBUTE_VALUE_LENGTH) {
    return `the value of "${name}" is at most ${MAX_ATTRIBUTE_VALUE_LENGTH} characters`;
  }
  if (hasControl(value)) return `the value of "${name}" has a control character`;
  if (name === 'role' && !ROLE_VALUE.test(value)) return 'role is a lowercase word';
  if (name === 'lang' && !LANG_VALUE.test(value))
    return 'lang is a language tag such as "en" or "pl"';
  if (name === 'dir' && value !== 'ltr' && value !== 'rtl' && value !== 'auto') {
    return 'dir is ltr, rtl or auto';
  }
  if (name === 'tabindex' && value !== '0' && value !== '-1') return 'tabindex is 0 or -1';
  return undefined;
}

/** Validates a list of classes. Returns it de-duplicated, in the author's order. */
export function checkClasses(value: unknown): Result<readonly string[], string> {
  if (!Array.isArray(value)) return err('classes is a list of class names');
  if (value.length > MAX_CLASSES) return err(`at most ${MAX_CLASSES} classes`);
  const seen = new Set<string>();
  for (const name of value as unknown[]) {
    if (!isValidClassName(name)) {
      return err(
        `"${String(name).slice(0, 40)}" is not a valid class name (letters, digits, dashes and underscores; no "b-" or "buildr" prefix; up to ${MAX_CLASS_LENGTH})`,
      );
    }
    seen.add(name);
  }
  return ok([...seen]);
}

/** Validates a map of attributes. Returns it with its keys sorted, so the stored form is canonical. */
export function checkAttributes(value: unknown): Result<Readonly<Record<string, string>>, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err('attributes is a map of names to text');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_ATTRIBUTES) return err(`at most ${MAX_ATTRIBUTES} attributes`);
  const out: Record<string, string> = {};
  for (const [name, raw] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!isAllowedAttributeName(name)) {
      return err(
        `the attribute "${name.slice(0, 40)}" is not allowed (data-*, aria-*, role, title, lang, dir, tabindex; not data-b*)`,
      );
    }
    if (typeof raw !== 'string') return err(`the value of "${name}" must be text`);
    const problem = attributeValueError(name, raw);
    if (problem !== undefined) return err(problem);
    Object.defineProperty(out, name, {
      value: raw,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return ok(out);
}
