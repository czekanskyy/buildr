# ADR-001: Monorepo tooling

**Status:** Accepted

## Context

Buildr ships many tightly-coupled packages (`core`, `react`, `components`, `editor`, `next`, `payload`) that must evolve together, share tooling, and be tested against each other on every change. We need a repository layout and build tooling that keeps cross-package changes atomic and CI fast, while remaining approachable for external contributors and coding agents.

## Options

1. **Polyrepo** — one repository per package. Rejected: cross-cutting changes (e.g. a new `Value` kind touching core, react, editor, payload) would require coordinated multi-repo PRs and version pinning gymnastics.
2. **npm/yarn workspaces only** — simple, but no task graph, no caching, no `--affected` support.
3. **Nx** — strong module-boundary tooling and generators, but heavier configuration surface and a steeper learning curve for contributors and agents.
4. **pnpm workspaces + Turborepo + dependency-cruiser** — pnpm's strict `node_modules` layout catches phantom dependencies (a package using something it didn't declare), Turborepo gives a simple, fast task graph with caching and `--affected`, and dependency-cruiser enforces the architectural import rules that pnpm alone cannot.

## Decision

Use **pnpm workspaces + Turborepo**, with `dependency-cruiser` as a dedicated, CI-enforced boundary checker. Package versioning uses the **fixed** Changesets group (all `@next-buildr/*` packages share one version number, the same approach Payload itself uses), which removes any compatibility matrix between our own packages.

## Consequences

- Atomic cross-package changes and a single CI pipeline.
- Architectural boundaries are enforced by tooling (`pnpm check:boundaries`), not by repository structure — a wrong import inside one package is still possible unless dependency-cruiser catches it, so that check is mandatory in CI, not advisory.
- Contributors need pnpm ≥ 10 and Node ≥ 22 installed; documented in `docs/getting-started.md`.
- Fixed versioning means every release bumps every package, even unchanged ones — acceptable for a project at this stage and consistent with Payload's own approach.
