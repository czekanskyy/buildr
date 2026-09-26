# AGENTS.md — rules for coding agents (Buildr)

This file is mandatory reading for every coding agent (and human) working in this repository.

## Before you start

1. Work on **exactly one** task `PB-xxx` from [`docs/backlog/`](docs/backlog/README.md). Read its card. Every dependency of the task must have status **Done**.
2. Read [`docs/ai/architecture-rules.md`](docs/ai/architecture-rules.md), [`docs/ai/package-boundaries.md`](docs/ai/package-boundaries.md) and every document referenced by the task card.
3. Do not widen the scope. If the task needs an architectural decision that is not covered by an existing ADR, stop, describe the question in the pull request (label `needs-decision`) and do not implement speculatively.

## Where logic lives

| You want to… | Go to |
|---|---|
| change the document model | `packages/core/src/document` (+ a migration in `core/src/migrations/document`) |
| add or change a component | `packages/components/src/<name>/` ([`docs/ai/component-development.md`](docs/ai/component-development.md)) |
| add a prop kind | `packages/core/src/schema/kinds` + a control in `packages/editor/src/panels/inspector/controls` |
| add an expression function | `packages/core/src/expressions/stdlib` |
| add a style property | `packages/core/src/styles/properties.ts` (+ grammar, compiler, inspector) |
| add a command | `packages/core/src/commands/handlers` |
| change the canvas protocol | `packages/core/src/protocol` (bump the protocol version) |
| renderer | `packages/react/src/render` |
| canvas runtime | `packages/react/src/canvas` |
| editor UI | `packages/editor/src/{panels,toolbar,canvas-host,dnd,persistence}` |
| Payload | `packages/payload/src/{plugin,data,adapter,admin,next,contract.ts}` |
| Next.js | `packages/next/src` |
| localization | model: `core/src/values` (`l10n`); editor: `editor/src/store/locale.ts`; built-in strings: `components/src/messages` |

## Commands

```
pnpm i                      # install
pnpm dev                    # playground (editor + canvas + fixture gallery)
pnpm dev:example            # Next.js + Payload example app
pnpm test                   # all tests (affected via turbo)
pnpm test --filter @next-buildr/core
pnpm typecheck
pnpm lint
pnpm check:boundaries       # architectural import rules (dependency-cruiser)
pnpm changeset              # add a changeset
pnpm e2e                    # Playwright end-to-end tests
```

(Commands become available as the foundation tasks PB-001 – PB-004 land.)

## MUST

- Mutate documents **only** through commands from `@next-buildr/core/commands`.
- Validate external data (database, clipboard, postMessage, HTTP) with a Zod schema at the boundary.
- A change to the shape of the document or of a component's props requires a migration, a migration fixture and a test.
- Changing a prop's `default` value is a breaking change and requires a migration that writes the old default.
- Every change to a package's public API requires a changeset.
- Write tests according to [`docs/ai/testing-rules.md`](docs/ai/testing-rules.md). Never update snapshots without reviewing the diff.
- New components meet the component Definition of Done ([`docs/ai/component-development.md`](docs/ai/component-development.md)).
- Update the documentation in `docs/` for the area you changed.

## MUST NOT

- Import `react`/`next`/`payload` in `@next-buildr/core`; `next`/`payload` in `@next-buildr/react` and `@next-buildr/components`; `@next-buildr/react` or `@next-buildr/components` in `@next-buildr/editor`; `payload` in `@next-buildr/payload/adapter`.
- Create global, mutable registries or singletons.
- Fetch data inside components (use `DataSource` + `prepareRender`).
- Use `eval`, `new Function`, `dangerouslySetInnerHTML`, or raw CSS/HTML coming from user data.
- Add `Dynamic*` components — dynamic values are handled by `Value<T>`.
- Store HTML/JSX or runtime state in the document.
- Modify released migrations (they are immutable — add a new one).
- Add runtime dependencies without justification in the PR (in core: only after an ADR).
- Call `postMessage` with target origin `'*'`.
- Hard-code user-visible strings in site components or the editor UI (use `localizable` props / the `messages` catalog).

## Definition of Done (summary)

Acceptance criteria of the card are met · tests are green locally · typecheck, lint and boundaries pass · changeset added · docs updated · no `TODO` without an issue · PR title contains the task ID. Full version: [`docs/contributing.md`](docs/contributing.md#definition-of-done).

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — the big picture
- [`docs/ai/architecture-decisions.md`](docs/ai/architecture-decisions.md) — why things are the way they are
- [`docs/ai/task-workflow.md`](docs/ai/task-workflow.md) — branches, PRs, blockers
