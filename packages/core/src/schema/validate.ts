import { z } from 'zod';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { booleanValueSchema } from './kinds/boolean.ts';
import { iconValueSchema } from './kinds/icon.ts';
import type { PropDef, PropDefBase } from './kinds/index.ts';
import { linkValueSchema } from './kinds/link.ts';
import { listSourceValueSchema } from './kinds/list-source.ts';
import { mediaValueSchema } from './kinds/media.ts';
import { numberValueSchema } from './kinds/number.ts';
import { richTextValueSchema } from './kinds/rich-text.ts';
import { selectValueSchema } from './kinds/select.ts';
import { textValueSchema } from './kinds/text.ts';
import { textareaValueSchema } from './kinds/textarea.ts';

// `list`/`object` nest arbitrary `PropDef`s (see kinds/list.ts, kinds/object.ts), but their
// `of`/`fields` are typed against the narrower `PropDefBase` to avoid a circular import with this
// module. Every value reaching here was built by `p.*`, so it is always a real `PropDef`.
function asPropDef(def: PropDefBase): PropDef {
  return def as PropDef;
}

function buildSchema(def: PropDef): z.ZodType {
  switch (def.kind) {
    case 'text':
      return textValueSchema(def);
    case 'textarea':
      return textareaValueSchema(def);
    case 'richText':
      return richTextValueSchema(def);
    case 'number':
      return numberValueSchema(def);
    case 'boolean':
      return booleanValueSchema(def);
    case 'select':
      return selectValueSchema(def);
    case 'link':
      return linkValueSchema(def);
    case 'media':
      return mediaValueSchema(def);
    case 'icon':
      return iconValueSchema(def);
    case 'listSource':
      return listSourceValueSchema(def);
    case 'list': {
      let schema = z.array(schemaFor(asPropDef(def.of)));
      if (def.min !== undefined) schema = schema.min(def.min);
      if (def.max !== undefined) schema = schema.max(def.max);
      return schema;
    }
    case 'object':
      return z.strictObject(
        Object.fromEntries(
          Object.entries(def.fields).map(([key, field]) => [key, schemaFor(asPropDef(field))]),
        ),
      );
  }
}

// A definition is immutable data, so its schema is derived once per object. A WeakMap keeps this
// cache from being a global registry: entries live and die with the definitions themselves.
const schemaCache = new WeakMap<object, z.ZodType>();

function schemaFor(def: PropDef): z.ZodType {
  let schema = schemaCache.get(def);
  if (schema === undefined) {
    schema = buildSchema(def);
    schemaCache.set(def, schema);
  }
  return schema;
}

/**
 * Validates `value` against `def`'s own kind (docs/component-registry.md#props-dsl-p). The Zod
 * schema is derived from `def` (once per definition object), since a `PropDef` that round-tripped
 * through the JSON manifest (ADR-003) carries no live functions of its own.
 */
export function validatePropValue(def: PropDef, value: unknown): Result<unknown, Diagnostic> {
  const result = schemaFor(def).safeParse(value);
  if (result.success) return ok(result.data);
  return err({
    code: 'prop.invalid-value',
    message: result.error.issues[0]?.message ?? `invalid value for prop kind "${def.kind}"`,
    severity: 'error',
    details: { kind: def.kind },
  });
}
