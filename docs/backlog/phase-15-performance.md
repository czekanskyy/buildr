# Phase 15: Performance budgets

Makes the performance budgets in [../performance.md](../performance.md) measurable and enforced. It closes the roadmap exit criterion "Performance budgets on a 1000-node fixture — not measured" (see [../roadmap.md](../roadmap.md#exit-criteria-and-where-they-stand-at-100)) in two steps: node-level benchmarks that run without a browser (PB-148, PB-149), and browser-level budgets later (PB-150).

[../performance.md](../performance.md) currently says that nightly `vitest bench` benchmarks exist. They do not. PB-149 replaces that sentence with what is actually measured.

## Decisions (Q&A with the maintainer, 2026-10-10)

| # | Question | Decision | Rejected |
|---|---|---|---|
| P1 | What do the node-level budgets assert? | **Proxy budgets that are a part of each user-facing budget**, measured on a 1000-node fixture: open-core <= 500 ms (of 1.5 s), select <= 10 ms (of 50), prop edit p95 <= 25 ms (of 50), `computeDropTarget` <= 4 ms (of 16), autosave `JSON.stringify` <= 20 ms, undo <= 30 ms. At 5000 nodes: the absolute value must be <= 5x the 1000-node budget, and the 5000/1000 median ratio must be <= 8, checked only for operations whose 1000-node median is >= 1 ms (below that, timer noise dominates the ratio) | Asserting the full user-facing budgets on Node (it does not include rendering, so a pass would prove nothing); ratios for every operation |
| P2 | Where is the gate? | **Strict (x1 budgets) runs only in the nightly workflow and only turns it red.** Pull requests run a smoke mode (x4 budgets) through the normal test job. Releases are not blocked | A strict gate on every PR (runner noise); blocking releases |
| P3 | Browser-level budgets | **PB-150**, as a card only for now | Doing them in this phase |
| P4 | Production CSS budget | **Asserted on the 1000-node fixture in PB-149** (page node CSS < 50 KB, gzip < 10 KB). The "0 KB of builder JS" budget stays not measured | Leaving both unmeasured |
| P5 | Tooling | **Plain timed vitest tests with a `measure()` helper** | The vitest 5 `bench` fixture (marked experimental in the installed types) |

## Order

```
PB-148 -> PB-149 -> PB-150 (card only, not scheduled)
```

---

## PB-148 - Large-document fixture generator - M

- **Purpose**: one deterministic, realistic large document that the benchmarks (PB-149), the browser budgets (PB-150) and the outline-size criterion of PB-135 can all share.
- **Dependencies**: none open (PB-009, the fixture corpus, is Done)
- **Files**: `packages/test-utils/src/fixtures/large/**`, `packages/test-utils/src/index.ts`, `docs/backlog/**` (this phase), an empty changeset (`@next-buildr/test-utils` is private)
- **Implementation**: `createLargeDocument({ nodes, seed? })` returning a document with exactly `nodes` nodes. Ids come from `createSeededIdGenerator` (core), and the document is built with the `doc()` / `NodeTree` builders. It is made of realistic sections (hero, feature grids, cards, pricing, FAQ, forms and so on) written as plain data using the real component type strings. `test-utils` does **not** import `@next-buildr/components`, because that would create a workspace cycle. The sections use `l10n` values, bindings, formulas and breakpoint styles, so the benchmarks exercise the expensive paths and not only static text.
- **Tests**: the node count is exact for 1000 and 5000; the same seed gives the same document and a pinned hash guards against accidental drift; structural invariants hold (`assertDocumentInvariants`); `parseDocument` with its default resource limits accepts the document (node count, children per slot, depth, JSON size).
- **Acceptance criteria**: tests are green; the fixture is accepted by `parseDocument` with default limits.
- **Risks**: the fixture drifting from the component prop schemas, because it does not import them. PB-149 catches this by validating the fixture against the default registry.

## PB-149 - Node-level performance benchmarks and nightly gate - L

- **Purpose**: measure the budgets from [../performance.md](../performance.md) as Node proxies, assert them (P1) and run the strict version nightly (P2).
- **Dependencies**: PB-148
- **Files**: `tooling/bench/**` (a new private package `@next-buildr/repo-bench`, version 1.0.0, like `tooling/smoke`), `.github/workflows/nightly.yml`, root `package.json` (`check:boundaries` also covers `tooling/bench`), `.gitignore`, `turbo.json` only if needed, `docs/{performance,roadmap,contributing}.md`, an empty changeset
- **Implementation**:
  - **Measurement contract.** `measure()` takes explicit warm-up and sample counts, reports the median and p95 by the nearest-rank method, awaits async bodies, and keeps setup outside the timed region.
  - **Open-core**: every sample starts from a JSON string, so identities are fresh, and goes through `parseDocument` plus `validateDocument`. `validateDocument` already builds the index and compiles styles, so those steps are not repeated.
  - **Edits** are chained on the evolving document to keep realistic structural sharing. Each edit is asserted to produce non-empty patches; the forward patches are applied to a separate pre-edit canvas copy and the result is compared with the command's result.
  - **`checkInvariants`** is set explicitly and the choice is documented (the editor store default is `false`).
  - **History** uses an injected clock and explicit merge keys, so coalescing does not depend on speed. The undo timing includes applying the inverse patches, and the state is reset between samples.
  - **`prepareRender`** runs with `MemoryDataSource` and representative bindings, media and queries; its results are asserted, not only timed.
  - **Fixture validity**: the fixture is validated against `createDefaultRegistry` with zero issues of any severity, with explicit locales and an explicit data schema. One section is rebuilt through `executeBatch`.
  - **Production CSS** (P4): the page node CSS of the 1000-node fixture is asserted under 50 KB, gzip under 10 KB.
  - **Smoke and strict modes**: smoke (x4 budgets) runs in the PR test job. Turbo runs tests with a concurrency of 2, which is why the multiplier is generous. Strict (x1) runs only nightly, directly with `pnpm --filter @next-buildr/repo-bench test:strict`, never through a cached turbo task.
  - **Results**: a JSON file with the metrics, the Node version and the CPU model only (never the environment, user information or absolute paths) is written to `tooling/bench/results/` (not a dot-folder, and gitignored) **before** the assertions run. The nightly job uploads it with `actions/upload-artifact@v4`, `if: always()`, `if-no-files-found: error` and 30 days of retention.
  - **Nightly job**: uses the composite `./.github/actions/setup` with Node 24, actions pinned by major tag like the rest of the file, `actions/checkout` with `persist-credentials: false`, `permissions: contents: read` only, no secrets, no new triggers, and a 20-minute timeout.
  - **Calibration**: the budgets are calibrated with repeated runner measurements before strict mode is enabled.
- **Tests**: tests for the helper (quantiles, warm-ups, async bodies); one performance test per area (open-core, select, prop edit, `computeDropTarget`, autosave serialization, undo, `prepareRender`, CSS size) at 1000 and 5000 nodes.
- **Acceptance criteria**: the strict run is green through `workflow_dispatch`; smoke mode shows no flakes in 10 local and 3 CI runs; [../performance.md](../performance.md) shows the measured medians, labelled as Node proxies and with the runner details, and no longer mentions `vitest bench`; the roadmap exit row reads "Partly met" and its Known gaps entry is updated; the CI section of [../contributing.md](../contributing.md) describes the smoke and strict modes.
- **Risks**: runner noise (mitigated by the smoke multiplier, the calibration and a nightly-only gate); the proxies understate the browser cost (stated in the documentation, closed by PB-150); the caches (the `createIndex` and `compileStyles` WeakMaps, `styles/cache.ts`) hiding work, so each sample must use fresh identities.

## PB-150 - Browser-level performance budgets (Playwright) - L

Status: **card only, not scheduled** (P3). Start only after PB-149 has landed and the maintainer confirms it is wanted.

- **Purpose**: measure the user-facing budgets themselves, including rendering, which the Node proxies cannot see.
- **Dependencies**: PB-149
- **Files**: to be decided when the card is scheduled (the playground app and its Playwright suite, the nightly workflow, the performance documentation)
- **Implementation**: the playground loads the 1000-node fixture from PB-148. Playwright measures, with `performance.mark` / `performance.measure`: opening the document in the editor, selecting a node until the inspector updates, a prop edit until the canvas patch is applied, and one drag-and-drop frame. It runs nightly only and is never a PR gate.
- **Tests**: this task is the test suite.
- **Acceptance criteria**: to be defined when the card is scheduled; the budgets are the user-facing ones from [../performance.md](../performance.md).
- **Risks**: browser timings on shared runners are noisier than Node timings, so the thresholds need their own calibration.
