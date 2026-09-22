# Task workflow for AI agents

## Picking a task

1. Open [`../backlog/README.md`](../backlog/README.md) and find a task whose dependencies are all `Done`.
2. Read the full card: Purpose, Dependencies, Files, Implementation, Tests, Acceptance criteria, Risks.
3. Check [`../backlog/dependency-graph.md`](../backlog/dependency-graph.md) to see what else could run in parallel — useful context, not a constraint on you.
4. Confirm no other agent/PR is already working the same task ID.

## Working the task

1. Branch: `pb-xxx/short-slug`.
2. Read every document the card references before writing any code.
3. Touch only the files/directories the card lists, plus tests and documentation for the area you changed. If you find you need to touch something outside that list, that's a signal the task is either mis-scoped (flag it) or you've misunderstood it (re-read the card).
4. Commit using Conventional Commits, scoped to the package: `feat(core): ...`, `fix(editor): ...`, etc.
5. Implement, test, and self-review against the card's acceptance criteria one by one.

## Opening the PR

- Title: `<type>(<scope>): <summary> (PB-xxx)`.
- Fill in the PR template checklist: tests, changeset, docs, `pnpm check:boundaries` passing, accessibility (if UI), screenshots (if UI), migration (if the change affects document/prop schema).
- Reference the task ID in the description, not just the title.

## When you're blocked

- A missing architectural decision: stop, do not guess, label the PR `needs-decision`, describe the question and the options as you understand them (see [architecture-decisions.md](architecture-decisions.md)).
- A dependency task turns out to be incomplete or wrong: comment on the task card / open a linked issue, label `blocked`, and do not silently work around it by reimplementing part of the blocking task inline.
- Ambiguity in the card itself that a reasonable person couldn't resolve from the referenced docs: ask, rather than picking an interpretation silently.

## Backward compatibility

- Any change to the document schema or to a component's prop schema needs a migration — see [`../migrations.md`](../migrations.md). This is not optional and not deferrable to a later task.
- Published package entry points (see the `exports` table in [`../architecture.md`](../architecture.md)) are the semver surface; `internal/` is not. Changing a published entry point's shape needs a changeset that reflects the actual severity (patch/minor/major per the project's 0.x conventions in [`../contributing.md`](../contributing.md)).
