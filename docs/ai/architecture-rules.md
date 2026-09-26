# Architecture rules for AI agents

These are the invariants of the system. They do not change without an ADR amendment.

## Dependency direction

```
core
  -> react -> components
  -> editor

core + react -> next
core (+ next) -> payload
```

Never the other way around. `pnpm check:boundaries` enforces this mechanically in CI (dependency-cruiser) — see [package-boundaries.md](package-boundaries.md) for the exact per-package table.

## Layers inside `@next-buildr/core`

```
L0: ids, json, result
L1: document, schema                                  -> L0
L2: registry, data, expressions, styles               -> L0-L1  (within-level imports are allowed as long as no cycle forms, e.g. expressions -> data)
L3: values, rules, templates, forms, migrations        -> L0-L2
L4: prepare, validation, a11y, dnd, commands          -> L0-L3  (commands does not import a11y/validation/prepare)
protocol                                               -> L0, document (types only)
```

## Project invariants

1. **The AST is the source of truth.** Never store HTML or JSX. Never store runtime state in the document — only initial values as props.
2. **Commands are the only mutation path.** No UI code, no canvas handler, no clipboard operation, no script mutates a document directly — everything goes through `@next-buildr/core/commands`.
3. **The registry has no global, mutable state.** `createRegistry()` is immutable; extension means constructing a new registry, never mutating a shared one.
4. **The renderer is pure.** Components never fetch their own data. All data arrives pre-resolved via `prepareRender` + `DataSource`.
5. **The editor never renders the document.** It drives a canvas (a real Next.js route) through the `postMessage` protocol. The editor package does not depend on `@next-buildr/react` or `@next-buildr/components`.
6. **The canvas only talks to the editor through the versioned protocol.** No direct DOM/JS coupling between the two documents (they are, after all, different browsing contexts).
7. **Every external input is validated at its boundary.** Database rows, clipboard contents, postMessage payloads, HTTP bodies — all pass through a Zod schema before anything else touches them. Core functions never throw for bad *data* — they return `Result`/`Diagnostic`; a thrown exception signals a programmer error, not a data problem.
8. **`@next-buildr/core` has zero framework dependencies** — no React, no Next.js, no Payload, and no ambient DOM globals (the `protocol` subpath is the one exception, and only through injected `WindowLike` interfaces, never `window` directly).

See [architecture.md](../architecture.md) for the full picture and [ADR index](../adr/README.md) for why each of these rules exists.
