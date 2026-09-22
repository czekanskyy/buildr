# Working as an AI coding agent on Buildr

Start at [`AGENTS.md`](../AGENTS.md) in the repository root — it is the single mandatory entry point and is kept short on purpose. This page is a pointer to the deeper material it references.

## Reading order

1. [`AGENTS.md`](../AGENTS.md) — must-read for every task.
2. [`ai/architecture-rules.md`](ai/architecture-rules.md) — the invariants that never change.
3. [`ai/package-boundaries.md`](ai/package-boundaries.md) — exactly which package may import which.
4. The specific task card in [`backlog/`](backlog/README.md), and every document it references.
5. Task-specific deep dives: [`ai/coding-rules.md`](ai/coding-rules.md), [`ai/component-development.md`](ai/component-development.md), [`ai/testing-rules.md`](ai/testing-rules.md), [`ai/task-workflow.md`](ai/task-workflow.md).
6. [`ai/architecture-decisions.md`](ai/architecture-decisions.md) if a decision seems to be missing an ADR.

## The one rule that matters most

Work on exactly one backlog task per session/PR. Do not implement ahead of the backlog's stated order, do not widen a task's file list, and do not make an architectural call that isn't already covered by an ADR — flag it instead (`needs-decision` label) and stop. The backlog's dependency graph ([`backlog/dependency-graph.md`](backlog/dependency-graph.md)) exists specifically so multiple agents can work in parallel without colliding — respect it.
