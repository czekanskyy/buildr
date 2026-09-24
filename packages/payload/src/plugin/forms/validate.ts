import type { FormFieldSchema, FormSchema } from '@buildr/core';

export type SubmissionErrorCode = 'unknown' | 'required' | 'invalid' | 'too-long';

export interface SubmissionError {
  readonly field: string;
  readonly code: SubmissionErrorCode;
}

export type Submission =
  | { readonly ok: true; readonly data: Record<string, string | number | boolean> }
  | { readonly ok: false; readonly errors: readonly SubmissionError[] };

/** A field without an author-set limit still has one: nobody stores megabytes in a text field. */
export const DEFAULT_MAX_LENGTH = 5000;
const EMAIL_MAX = 254;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const TEL = /^\+?[0-9()\s.-]{3,32}$/;
const TRUE = new Set(['true', 'on', '1', 'yes']);
const FALSE = new Set(['false', 'off', '0', 'no']);

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

type Checked =
  | { readonly ok: true; readonly value: string | number | boolean | undefined }
  | { readonly ok: false; readonly code: SubmissionErrorCode };

const bad = (code: SubmissionErrorCode): Checked => ({ ok: false, code });

function checkField(field: FormFieldSchema, raw: unknown): Checked {
  if (field.valueType === 'boolean') {
    let on = false;
    if (typeof raw === 'boolean') on = raw;
    else if (typeof raw === 'string' && TRUE.has(raw.toLowerCase())) on = true;
    else if (raw !== undefined && !(typeof raw === 'string' && FALSE.has(raw.toLowerCase()))) {
      return bad('invalid');
    }
    if (field.required && !on) return bad('required');
    return { ok: true, value: on };
  }
  if (isEmpty(raw)) return field.required ? bad('required') : { ok: true, value: undefined };

  if (field.valueType === 'number') {
    const parsed =
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
    return Number.isFinite(parsed) ? { ok: true, value: parsed } : bad('invalid');
  }
  if (typeof raw !== 'string') return bad('invalid');
  const value = raw.trim();
  if (value.length > (field.maxLength ?? DEFAULT_MAX_LENGTH)) return bad('too-long');
  switch (field.valueType) {
    case 'email':
      return value.length <= EMAIL_MAX && EMAIL.test(value) ? { ok: true, value } : bad('invalid');
    case 'tel':
      return TEL.test(value) ? { ok: true, value } : bad('invalid');
    case 'url': {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:'
          ? { ok: true, value }
          : bad('invalid');
      } catch {
        return bad('invalid');
      }
    }
    case 'enum':
      return field.options?.includes(value) === true ? { ok: true, value } : bad('invalid');
    default:
      return { ok: true, value };
  }
}

/**
 * Checks a submission against the schema derived from the published document. The schema is the
 * only thing that decides: a name it does not contain is an error (`unknown`), never ignored, and
 * every value is checked against the type, length and options of its field. Never throws.
 */
export function validateSubmission(
  schema: FormSchema,
  input: Readonly<Record<string, unknown>>,
): Submission {
  const errors: SubmissionError[] = [];
  const known = new Set(schema.fields.map((field) => field.name));
  for (const name of Object.keys(input)) {
    if (!known.has(name)) errors.push({ field: name, code: 'unknown' });
  }
  const data: Record<string, string | number | boolean> = {};
  for (const field of schema.fields) {
    const raw = Object.hasOwn(input, field.name) ? input[field.name] : undefined;
    const checked = checkField(field, raw);
    if (!checked.ok) errors.push({ field: field.name, code: checked.code });
    else if (checked.value !== undefined) data[field.name] = checked.value;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data };
}
