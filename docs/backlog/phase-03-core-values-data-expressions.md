# Phase 3: Core, values, data, expressions

## PB-019 - Safe paths, `DataContext`, `DataSchema` - M

- **Purpose**: data access with no prototype-pollution risk (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-013
- **Files**: `packages/core/src/data/{path,context,schema}.ts`
- **Implementation**: `parsePath`, `getPath`, `DataContext`, `DataSchema`, `schemaAtPath`, `listPaths(schema, filter)`, `pushScope`.
- **Tests**: `__proto__`, `constructor.prototype`, depth limits, array indices; a property-based test asserting no prototype value is ever returned.
- **Acceptance criteria**: 100% branch coverage on the security-relevant paths.
- **Risks**: none.

## PB-020 - Sanitization and the rich text format - M

- **Purpose**: safe URLs and validated rich text (see `docs/renderer.md`, `docs/security.md`).
- **Dependencies**: PB-006
- **Files**: `packages/core/src/values/{sanitize,richtext}.ts`
- **Implementation**: `sanitizeUrl`, `capString`, `richTextSchema` (a Lexical subset), `normalizeRichText` (drops unknown nodes with a diagnostic), `plainTextToRichText`.
- **Tests**: a malicious-URL corpus (OWASP-style cases, control characters, entity encoding, case variation); rich text containing unknown node types.
- **Acceptance criteria**: nothing in the malicious-URL corpus is accepted.
- **Risks**: an incomplete corpus — extended over time via the `SECURITY.md` process.

## PB-021 - The binding resolver and formatters - M

- **Purpose**: resolving bindings (see `docs/dynamic-bindings.md`).
- **Dependencies**: PB-019, PB-020
- **Files**: `packages/core/src/values/{resolve-binding,coerce,format}.ts`
- **Implementation**: coercions per the table in `docs/dynamic-bindings.md`; `format` via `Intl`, using the context's `locale`/`timeZone`; a fallback chain; diagnostics.
- **Tests**: the coercion table; PL/EN formatting (dates, currency, numbers); a property-based test asserting no exceptions are ever thrown.
- **Acceptance criteria**: identical output in Node and in the browser given the same `timeZone`.
- **Risks**: ICU differences across environments — snapshots are limited to stable formats only.

## PB-022 - Expressions: lexer, parser, printer - L

- **Purpose**: a safe parser (see `docs/expressions.md`).
- **Dependencies**: PB-006
- **Files**: `packages/core/src/expressions/{lexer,parser,ast,printer,template}.ts`
- **Implementation**: a Pratt parser matching the documented grammar, spans, limits (length, token count, depth), template mode (`{{ }}`).
- **Tests**: precedence and associativity, position-tagged error messages; a property-based round-trip test (`parse(print(ast)) === ast`); fuzzing (no exception or hang on arbitrary input).
- **Acceptance criteria**: under 0.1ms for a typical expression; zero dependencies.
- **Risks**: grammar creep — any grammar change requires an ADR-005 amendment.

## PB-023 - Expressions: evaluator and stdlib - L

- **Purpose**: sandboxed execution (see `docs/expressions.md`).
- **Dependencies**: PB-022, PB-019
- **Files**: `packages/core/src/expressions/{evaluate,compile}.ts`, `expressions/stdlib/*.ts`
- **Implementation**: a tree-walking interpreter with a step budget, the documented semantics, an allowlisted function set with arity/type checking, an LRU cache, `evaluate -> Result<JsonValue, Diagnostic>`.
- **Tests**: every stdlib function (including `plural` for Polish plural categories: 1, 2-4, 5+, 12-14, 22); limits; attempted prototype access; division by zero.
- **Acceptance criteria**: no `eval`/`Function` anywhere (enforced by lint plus a source-scanning test).
- **Risks**: none.

## PB-024 - Expression and template typechecking - M

- **Purpose**: static checking, both in the editor and at save time.
- **Dependencies**: PB-023
- **Files**: `packages/core/src/expressions/typecheck.ts`
- **Implementation**: type inference against `DataSchema`, function signatures, `unknown` when no schema is available, span-tagged diagnostics, comparison against `PropDef.accepts`.
- **Tests**: a tabular set (unknown paths, wrong argument types, an incompatible result type).
- **Acceptance criteria**: used by both `validateDocument` and the formula-editor UI.
- **Risks**: none.

## PB-025 - `resolveProps` and `visibleIf` - M

- **Purpose**: the single entry point for resolving a node's props.
- **Dependencies**: PB-021, PB-023, PB-014
- **Files**: `packages/core/src/values/resolve-props.ts`
- **Implementation**: `resolveProps(node, meta, ctx, prepared) -> { props, diagnostics }` (defaults, all three value kinds, `l10n` selection by `ctx.locale` with fallback, sanitization, kind validation, only known props passed through); `resolveVisibility`.
- **Tests**: a kind x value-kind matrix; default locale, a translated locale, a missing translation with and without fallback; diagnostics tagged with `nodeId`/`prop`; a property-based "never throws" test.
- **Acceptance criteria**: the result is fully serializable.
- **Risks**: none.

## PB-026 - `DataSource`, `QuerySpec`, `prepareRender` - L

- **Purpose**: declarative data for the renderer (see ADR-018).
- **Dependencies**: PB-025
- **Files**: `packages/core/src/data/{source,query-spec}.ts`, `packages/core/src/prepare/{prepare,memory-source}.ts`, `packages/test-utils/src/contracts/data-source.ts`
- **Implementation**: the interfaces from `docs/dynamic-bindings.md`; `querySpecSchema`; `resolveQuerySpec`; `prepareRender` (batched media lookups, Loop queries with a concurrency cap of 4, `collectionsUsed`, an error for a query dependent on `item`); `MemoryDataSource`; a **shared `DataSource` contract test suite** (reused later by PB-098).
- **Tests**: a single `getMedia` call batches multiple images; a source error becomes a diagnostic, never a thrown exception; the operator contract test suite passes.
- **Acceptance criteria**: `PreparedData` is fully serializable.
- **Risks**: differing operator semantics between `MemoryDataSource` and Payload — covered by the shared contract tests.
