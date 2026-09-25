# Contributing

Buildr is built task by task from the [implementation backlog](backlog/README.md). Please also read [AGENTS.md](../AGENTS.md) — it applies equally to human contributors and coding agents.

## Workflow

1. Pick a task `PB-xxx` from the backlog whose dependencies are all marked Done. Read its card in full.
2. Branch from `main`: `pb-xxx/short-slug`.
3. Read every document the task card references before writing code.
4. Implement exactly what the card describes — no scope creep. If you discover the task needs a decision not covered by an existing ADR, stop and open the PR anyway with a `needs-decision` label, describing the open question.
5. Write the tests the card requires (see [testing.md](testing.md) and [ai/testing-rules.md](ai/testing-rules.md)).
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries` locally.
7. Add a changeset (`pnpm changeset`) for any change to a published package.
8. Open a PR titled with [Conventional Commits](https://www.conventionalcommits.org/) syntax and the task ID, e.g. `feat(core): add document index (PB-008)`. Fill in the PR template checklist.

## Branching, commits, releases

- Trunk-based development on a protected `main` (required CI checks, plus one human review — including for PRs opened by agents).
- Squash merge. Short-lived branches.
- Conventional Commits scopes match package names: `core`, `react`, `components`, `editor`, `next`, `payload`, `repo`, `docs`.
- Versioning uses a **fixed** Changesets group — every `@buildr/*` package is released together, at the same version, the same approach Payload itself uses (see [ADR-001](adr/ADR-001-monorepo.md)).
- In the 0.x series, any breaking change requires a minor version bump and a migration note. From the very first release, the **document format itself is protected**: no version, including a 0.x one, may break previously-saved documents without a migration.
- `internal/` module exports are not covered by semver guarantees; only the package's declared entry points are.

## CI

- `quality`: install (frozen lockfile) -> lint -> `check:boundaries` -> typecheck.
- `test`: affected-aware test run with coverage thresholds (see [testing.md](testing.md)).
- `build`: package builds plus `publint` plus `@arethetypeswrong/cli` plus `size-limit`.
- `e2e`: Playwright against `example-next-payload`, sharded, only for affected changes.
- `visual`: nightly, plus the `visual` PR label.
- `changeset-check`, `pr-title`.
- `nightly`: a Node 22/24 x Next 15/16 x SQLite/Postgres matrix, benchmarks, the full E2E suite.
- `release`: on `main`, via `changesets/action`, with npm provenance.

## Definition of Done

See the full breakdown (general, component, composite/template, editor feature, Payload integration, Next.js integration) in [AGENTS.md](../AGENTS.md#definition-of-done-summary) and the expanded version referenced from each task category in the [backlog](backlog/README.md).

## Community files

- [`LICENSE`](../LICENSE) — MIT (added in task PB-005)
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — Contributor Covenant 2.1 (added in task PB-005)
- [`SECURITY.md`](../SECURITY.md) — private vulnerability reporting via GitHub, a 72-hour acknowledgement target (added in task PB-005)
- Issue and PR templates live under `.github/` (added in task PB-005)

## License

MIT, with no CLA — see [ADR-022](adr/ADR-022-license.md).

## Visual regression and accessibility checks (PB-113)

`apps/playground/e2e/visual` takes a screenshot of every gallery fixture at 375, 768 and 1280 px (`pnpm --filter @buildr/playground e2e:visual`) and compares it with the baselines in `e2e/visual/__screenshots__`. Fonts and anti-aliasing differ between operating systems, so the baselines are only ever taken in the Playwright Docker image, by the `Visual` workflow: a pull request without the `visual` label fails when a screenshot differs (the differences are uploaded as an artifact); a pull request **with** the `visual` label re-takes the baselines and commits them to the branch. Review the changed images in the diff before merging.

`e2e/a11y.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) over the gallery in the normal `pnpm --filter @buildr/playground e2e`; the example application's pages are checked by `apps/example-next-payload/e2e/public.spec.ts`.
