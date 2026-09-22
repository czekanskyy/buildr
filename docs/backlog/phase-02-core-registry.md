# Phase 2: Core, prop schema and the component registry

## PB-012 - `DataType` and the `p.*` props DSL - L

- **Purpose**: a serializable, typed description of component props (see `docs/component-registry.md`, `docs/dynamic-bindings.md`).
- **Dependencies**: PB-006
- **Files**: `packages/core/src/schema/{data-type,p,validate}.ts`, `schema/kinds/*.ts`
- **Implementation**: `DataType`; MVP kinds with metadata, a default value, a Zod validator, `accepts`, `localizable` (defaulted per `docs/i18n.md`), an inferred `InferProps<P>`; `PropDef` fully JSON-serializable.
- **Tests**: valid and invalid values for every kind; `expectTypeOf` assertions for the inference; serialization round-trips.
- **Acceptance criteria**: `JSON.stringify(propDef)` contains everything the inspector needs.
- **Risks**: type-inference complexity — inference is capped at two levels of `list`/`object` nesting.

## PB-013 - `Value<T>`: types, schemas, helpers - S

- **Purpose**: the static/binding/expression value model (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-012
- **Files**: `packages/core/src/values/{types,schema,helpers}.ts`
- **Implementation**: types (including `l10n` on `StaticValue` and on template-mode `ExpressionValue`), `LocaleCode`, `LocaleConfig`, `valueSchema(inner)`, guards, `s()`, `bind()`, `expr()`, `withTranslation(value, locale, v)`, `FormatSpec`; a narrowed `PageNode.props` type.
- **Tests**: every variant; an unknown `kind` is rejected; `l10n` is only permitted on static and template values.
- **Acceptance criteria**: existing document fixtures still validate.
- **Risks**: none.

## PB-014 - `ComponentMeta`, slots, the content model - M

- **Purpose**: component metadata (see `docs/component-registry.md`).
- **Dependencies**: PB-012, PB-007
- **Files**: `packages/core/src/registry/{meta,matchers,validate-meta}.ts`
- **Implementation**: types, `Matcher` (a type name or `#category`), `validateComponentMeta` (type-name shape, defaults matching their own validator, slot consistency, category consistency).
- **Tests**: a tabular set of valid and invalid definitions.
- **Acceptance criteria**: error messages are clear and actionable.
- **Risks**: none.

## PB-015 - The registry (metadata) and the manifest - M

- **Purpose**: an immutable registry and the manifest sent to the editor (see ADR-003).
- **Dependencies**: PB-014
- **Files**: `packages/core/src/registry/{registry,manifest}.ts`
- **Implementation**: `createRegistryMeta({ components, templates })`, `get/has/list/byCategory/extend`; `toManifest`, `fromManifest` (Zod), `manifestHash`.
- **Tests**: a duplicate type is rejected; the hash is deterministic and sensitive to changes; the manifest round-trips through JSON.
- **Acceptance criteria**: the manifest contains no functions (a JSON round-trip is a no-op).
- **Risks**: none.

## PB-016 - Nesting rules and locks - L

- **Purpose**: the single source of truth for drag-and-drop, paste, commands and validation (see `docs/component-registry.md`).
- **Dependencies**: PB-015, PB-008
- **Files**: `packages/core/src/rules/{can-insert,can-move,can-remove,can-edit,content-model,reasons}.ts`
- **Implementation**: slot allow/deny, `parents`, `requireAncestor`, global content-model rules (configurable), `slot.max`, cycle prevention, locks/regions, capabilities; `Reason { code, params, message }`.
- **Tests**: at least 40 tabular cases, every `Reason.code` covered.
- **Acceptance criteria**: messages are understandable by an end user.
- **Risks**: an overly restrictive content model — mitigated by a registry-level `contentRules` override.

## PB-017 - Component migrations and unknown types - M

- **Purpose**: evolving component prop schemas (see ADR-014).
- **Dependencies**: PB-015, PB-011
- **Files**: `packages/core/src/migrations/components.ts`
- **Implementation**: `migrateComponents(doc, migrations) -> { doc, applied, readOnlyReasons }` driven by `doc.components`; an unknown type is preserved with a diagnostic; a version newer than the registry knows marks the document read-only; the `components` map is updated; migration context is scoped to the node's own subtree only.
- **Tests**: a migration chain, an untouched unknown component, the read-only path.
- **Acceptance criteria**: deterministic, input-immutable.
- **Risks**: structural migrations — the context API is deliberately limited to a single subtree.

## PB-018 - Templates: definition and instantiation - M

- **Purpose**: composites (see `docs/templates.md`).
- **Dependencies**: PB-010, PB-015
- **Files**: `packages/core/src/templates/{define,instantiate,locks}.ts`
- **Implementation**: `TemplateDefinition`, `defineTemplate` (tree validation at registry-construction time), `instantiateTemplate(def, variant?, idGen)` setting `source` and `lock`, `findLockRoot`, `isInsideRegion`; `TemplateMeta` in the manifest.
- **Tests**: an instantiated template passes invariants and `canInsert`; variants; fresh IDs on every call.
- **Acceptance criteria**: the manifest's template entries contain no functions.
- **Risks**: none.
