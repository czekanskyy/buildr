import { walk } from '../document/traverse.ts';
import type { BuilderDocument, NodeId, PageNode } from '../document/types.ts';
import type { FormFieldMeta } from '../registry/meta.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';

/** One field a form accepts. Only fields that pass every check are here. */
export interface FormFieldSchema {
  readonly nodeId: NodeId;
  readonly name: string;
  readonly valueType: FormFieldMeta['valueType'];
  readonly required: boolean;
  readonly maxLength?: number;
  /** The allowed values of an `enum` field. */
  readonly options?: readonly string[];
}

/** What a submitted form may contain: the server-side source of truth (docs/components.md#form-field-derivation). */
export interface FormSchema {
  readonly formId: NodeId;
  readonly fields: readonly FormFieldSchema[];
}

export interface DerivedFormSchema {
  readonly schema: FormSchema;
  /** Problems with the form's fields; a field with one is left out of `schema`. */
  readonly diagnostics: readonly Diagnostic[];
}

export const MAX_FORM_FIELDS = 200;
export const MAX_FIELD_NAME_LENGTH = 64;
export const MAX_ENUM_OPTIONS = 500;

/** Letters, digits, `-` and `_`, starting with a letter: safe as a key and as an HTML `name`. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Names that would collide with what every object inherits. */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'toJSON',
]);

type Static = { readonly known: true; readonly value: unknown } | { readonly known: false };

/** A prop's value if it is a plain static one (the default-locale value); dynamic values are not known. */
function staticProp(node: PageNode, prop: string | undefined): Static | undefined {
  if (prop === undefined) return undefined;
  const value =
    node.props !== undefined && Object.hasOwn(node.props, prop) ? node.props[prop] : undefined;
  if (value === undefined) return undefined;
  return value.kind === 'static' ? { known: true, value: value.value } : { known: false };
}

function diagnostic(
  code: string,
  message: string,
  node: PageNode,
  prop?: string,
  severity: Diagnostic['severity'] = 'error',
): Diagnostic {
  return {
    code,
    message,
    severity,
    path: ['nodes', node.id, ...(prop === undefined ? [] : ['props', prop])],
    details: { nodeId: node.id, ...(prop === undefined ? {} : { prop }) },
  };
}

/** The values of a Select-style `options` prop: a list of `{ label, value }` (or plain strings). */
function optionValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const option of value.slice(0, MAX_ENUM_OPTIONS)) {
    const raw =
      typeof option === 'object' && option !== null && !Array.isArray(option)
        ? (option as Record<string, unknown>)['value']
        : option;
    // A value the author left empty would accept the empty submission as a choice.
    if (typeof raw === 'string' && raw !== '') out.push(raw);
    else if (typeof raw === 'number' && Number.isFinite(raw)) out.push(String(raw));
  }
  return out;
}

/**
 * What a submitted form is allowed to contain, read off the document alone: every descendant of
 * `formNodeId` whose component declares `formField` metadata is a field, named by its `nameProp`,
 * with the required flag, length limit and options its metadata points at. It never looks at what
 * component a node is, so custom controls take part automatically, and it never reads a dynamic
 * value (a bound name cannot be trusted to be stable, so such a field is refused).
 *
 * A field is left out, with a diagnostic, when its name is missing, dynamic, malformed, reserved
 * or already taken by an earlier field, or when an `enum` field has no usable options: a submission
 * carrying a name that is not in the schema is then rejected by the server. Fields of a nested
 * form belong to that form, not this one. Never throws.
 */
export function deriveFormSchema(
  doc: BuilderDocument,
  registry: RegistryMeta,
  formNodeId: NodeId,
): DerivedFormSchema {
  const form = Object.hasOwn(doc.nodes, formNodeId) ? doc.nodes[formNodeId] : undefined;
  if (form === undefined) {
    return {
      schema: { formId: formNodeId, fields: [] },
      diagnostics: [
        {
          code: 'form.not-found',
          message: `there is no node "${formNodeId}"`,
          severity: 'error',
          details: { nodeId: formNodeId },
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const fields: FormFieldSchema[] = [];
  const taken = new Set<string>();
  const skipInside = new Set<NodeId>();

  for (const node of walk(doc, formNodeId)) {
    if (node.id === formNodeId) continue;
    // A nested form is its own form; so are the fields inside it.
    if (node.type === form.type) {
      skipInside.add(node.id);
      continue;
    }
    if (isInside(doc, node, skipInside)) continue;

    const meta = registry.get(node.type)?.formField;
    if (meta === undefined) continue;

    if (fields.length >= MAX_FORM_FIELDS) {
      diagnostics.push(
        diagnostic('form.too-many-fields', `a form has at most ${MAX_FORM_FIELDS} fields`, node),
      );
      break;
    }

    const name = staticProp(node, meta.nameProp);
    if (
      name === undefined ||
      (name.known && (typeof name.value !== 'string' || name.value === ''))
    ) {
      diagnostics.push(
        diagnostic('form.name-missing', 'this field has no name', node, meta.nameProp),
      );
      continue;
    }
    if (!name.known) {
      diagnostics.push(
        diagnostic(
          'form.name-dynamic',
          'a field name cannot be bound to data',
          node,
          meta.nameProp,
        ),
      );
      continue;
    }
    const fieldName = String(name.value);
    if (
      !FIELD_NAME.test(fieldName) ||
      fieldName.length > MAX_FIELD_NAME_LENGTH ||
      RESERVED_NAMES.has(fieldName)
    ) {
      diagnostics.push(
        diagnostic(
          'form.name-invalid',
          `"${fieldName}" is not a valid field name: use letters, digits, - and _, starting with a letter`,
          node,
          meta.nameProp,
        ),
      );
      continue;
    }
    if (taken.has(fieldName)) {
      diagnostics.push(
        diagnostic(
          'form.name-duplicate',
          `the field name "${fieldName}" is used more than once in this form`,
          node,
          meta.nameProp,
        ),
      );
      continue;
    }

    const field = readField(node, meta, fieldName, diagnostics);
    if (field === undefined) continue;
    taken.add(fieldName);
    fields.push(field);
  }

  return { schema: { formId: formNodeId, fields }, diagnostics };
}

function isInside(doc: BuilderDocument, node: PageNode, forms: ReadonlySet<NodeId>): boolean {
  if (forms.size === 0) return false;
  for (const formId of forms) {
    const nested = doc.nodes[formId];
    if (nested === undefined) continue;
    for (const inner of walk(doc, formId)) if (inner.id === node.id) return true;
  }
  return false;
}

function readField(
  node: PageNode,
  meta: FormFieldMeta,
  name: string,
  diagnostics: Diagnostic[],
): FormFieldSchema | undefined {
  const required = staticProp(node, meta.requiredProp);
  const maxLength = staticProp(node, meta.maxLengthProp);
  const max =
    maxLength?.known === true &&
    typeof maxLength.value === 'number' &&
    Number.isInteger(maxLength.value) &&
    maxLength.value > 0
      ? maxLength.value
      : undefined;

  let options: string[] | undefined;
  if (meta.valueType === 'enum') {
    const raw = staticProp(node, meta.optionsProp);
    if (raw === undefined || !raw.known) {
      diagnostics.push(
        diagnostic(
          raw === undefined ? 'form.options-missing' : 'form.options-dynamic',
          raw === undefined
            ? 'a choice field needs options'
            : 'the options of a choice field cannot be bound to data',
          node,
          meta.optionsProp,
        ),
      );
      return undefined;
    }
    options = optionValues(raw.value);
    if (options === undefined || options.length === 0) {
      diagnostics.push(
        diagnostic('form.options-missing', 'a choice field needs options', node, meta.optionsProp),
      );
      return undefined;
    }
    options = [...new Set(options)];
  }

  return {
    nodeId: node.id,
    name,
    valueType: meta.valueType,
    // Only an explicit `true` makes a field required; a bound flag is not trusted to hold.
    required: required?.known === true && required.value === true,
    ...(max !== undefined ? { maxLength: max } : {}),
    ...(options !== undefined ? { options } : {}),
  };
}
