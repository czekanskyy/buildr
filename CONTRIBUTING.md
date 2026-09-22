# Contributing to Buildr

Thanks for your interest in contributing! The full contributor guide — workflow, branching,
commit and PR conventions, CI, and the Definition of Done — lives at
[`docs/contributing.md`](docs/contributing.md). Please read it, along with
[`AGENTS.md`](AGENTS.md) (which applies equally to human and AI contributors), before opening a
pull request.

In short:

1. Pick a task `PB-xxx` from the [implementation backlog](docs/backlog/README.md) whose
   dependencies are all `Done`.
2. Branch from `main`: `pb-xxx/short-slug`.
3. Implement exactly what the task card describes, with tests, and add a changeset
   (`pnpm changeset`) for any change to a published package's public API.
4. Open a PR titled per [Conventional Commits](https://www.conventionalcommits.org/), ending with
   the task ID, e.g. `feat(core): add document index (PB-008)`, and fill in the PR template.

By participating, you're expected to uphold the [Code of Conduct](CODE_OF_CONDUCT.md). Buildr is
[MIT licensed](LICENSE); see [ADR-022](docs/adr/ADR-022-license.md) for why.
