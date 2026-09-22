# Testing strategy

| Level | Tooling | Scope | When |
|---|---|---|---|
| Unit | Vitest | Every core module, package-local utilities | Every PR (affected packages) |
| Property-based | fast-check (via Vitest) | Random command sequences preserve invariants; undo-all restores the initial state; redo-all restores the final state; expression parser/printer round-trips; the CSS compiler never emits a forbidden character | PR |
| Schema | Vitest + a JSON fixture corpus | `fixtures/documents/{valid,invalid}/*.json` against `validateDocument` (diagnostic snapshots) | PR |
| Migration | Vitest + a versioned fixture corpus | `fixtures/migrations/v{n}/*.json` migrated and compared to the expected `v{latest}` output. Released migrations are pinned by a hash test | PR |
| Renderer | Vitest + `react-dom/server` | Fixture documents to normalized HTML snapshots: slots, bindings, fallbacks, Loop, `visibleIf`, unknown components, root attributes, rich text | PR |
| Component | Vitest + Testing Library + vitest-axe | Every component: defaults, root spread, variants, accessibility (axe against SSR output), keyboard behavior (interactive components), prop validation, migrations | PR |
| Integration (editor) | Vitest + Testing Library | Store + commands + UI: an inspector edit dispatches the right command; undo/redo through the UI; autosave against a fake adapter with fake timers; 409 conflict handling | PR |
| Protocol | Vitest (jsdom, MessageChannel) | Handshake; rejecting a bad origin/source/session; a version gap triggering resync | PR |
| Payload integration | Vitest + the Payload Local API (SQLite) | Plugin installation, hooks (validation, write-guard, migration), endpoints (auth, 403, 409, 422), publish flow, `DataSchema`, `QuerySpec` -> `where` against the allowlist, forms | PR (SQLite), nightly (Postgres) |
| Next renderer | Playwright against `example-next-payload` (built and started) | RSC rendering, metadata, draft mode, revalidation on publish, zero builder JS on a static page | PR (affected) |
| End-to-end | Playwright | The six MVP scenarios (see [roadmap.md](roadmap.md)), both locales, plus editor flows: insert, inline edit, a mobile-only style, a binding, save/autosave, reload, undo/redo, publish | PR (sharded) |
| Accessibility | @axe-core/playwright | The fixture gallery, example pages, and an editor-chrome smoke pass | PR |
| Visual regression | Playwright `toHaveScreenshot` (the Playwright Docker image, for deterministic font rendering) | The fixture gallery (every component and template, at 3 breakpoints) | Nightly, plus the `visual` PR label |
| Performance | `vitest bench`, Playwright traces | The budgets in [performance.md](performance.md) | Nightly |

**Sets that must never have coverage gaps**: AST -> renderer, AST migrations, the binding resolver, the style resolver/compiler, drag-and-drop commands (`computeDropTarget` plus `node.move`/`node.insert`), undo/redo (property-based), Payload integration (write-guard, concurrency), the Next.js renderer (RSC, draft mode, caching).

**Coverage thresholds**: `core` >= 90% lines and branches; `react`, `payload` >= 80%; `editor`, `components` >= 70%.

See also [ai/testing-rules.md](ai/testing-rules.md) for the concrete rules coding agents must follow when writing tests for a given change.
