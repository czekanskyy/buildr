# Phase 0: Foundation

## PB-000 - Materialize the blueprint into the repository - M

- **Purpose**: move the approved architecture blueprint into the repository as the source of truth agents work from.
- **Dependencies**: none
- **Files**: `AGENTS.md`, `README.md` (draft), `docs/*.md`, `docs/ai/*`, `docs/adr/ADR-001...023`, `docs/backlog/{README.md,phase-*.md,dependency-graph.md}`
- **Implementation**: split the blueprint's sections into the files per the documentation structure; write ADRs following the standard template; write task cards per phase; no product code.
- **Tests**: check markdown links for validity; run a backlog-consistency script (every dependency referenced exists, the dependency graph is acyclic).
- **Acceptance criteria**: every file has real content; every task card has all required fields; no dead links.
- **Risks**: the blueprint and `docs/` drifting apart over time. From this point on, `docs/` is the source of truth, not the original planning document.

## PB-001 - Scaffold the monorepo - M

- **Purpose**: the tooling foundation for the whole repository.
- **Dependencies**: PB-000
- **Files**: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tooling/tsconfig/*`, `vitest.workspace.ts`, `.nvmrc`, `.editorconfig`, `.gitignore`, `lefthook.yml`
- **Implementation**: set `packageManager: pnpm@10`, `engines.node >= 22`; define turbo tasks (`build/dev/test/typecheck/lint`) with correct `dependsOn`/`outputs`; strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `rewriteRelativeImportExtensions`, `moduleResolution: bundler`, `target: ES2022`); configure Biome; configure the Vitest workspace; write helper scripts in Node (not bash) so they work identically on Windows.
- **Tests**: `pnpm i && pnpm lint && pnpm typecheck && pnpm test` against a dummy test.
- **Acceptance criteria**: root-level commands work on Windows, macOS and Linux; a second turbo run hits the cache.
- **Risks**: Windows path differences — mitigated by writing scripts in Node.

## PB-002 - Package scaffolds and the exports convention - M

- **Purpose**: every package exists with correct entry points (see `docs/architecture.md`).
- **Dependencies**: PB-001
- **Files**: `packages/{core,react,components,editor,next,payload,test-utils}/{package.json,tsconfig.json,src/index.ts}` plus subpath entry files
- **Implementation**: `exports` points at `src/*.ts`; `publishConfig.exports` points at `dist`; `sideEffects: false` (except CSS); correct peer dependencies (react, next, payload); a `tsc -b` build plus a CSS-copy script; `test-utils` is `private`.
- **Tests**: a smoke import of every entry point (Vitest); `pnpm -r build`; `publint` plus `@arethetypeswrong/cli`.
- **Acceptance criteria**: every subpath resolves correctly in both Node and Vite; `pnpm pack` plus installing the resulting tarball in a scratch directory works.
- **Risks**: `publint`'s handling of `publishConfig.exports` under `pnpm pack` needs verification via the tarball-install test.

## PB-003 - Enforce architectural boundaries - S

- **Purpose**: automatic protection of the dependency rules (`docs/architecture.md`, `docs/ai/package-boundaries.md`).
- **Dependencies**: PB-002
- **Files**: `.dependency-cruiser.cjs`, a `check:boundaries` script, `tooling/boundary-fixtures/`
- **Implementation**: forbidden-import rules between packages and between core's L0-L4 layers; forbid importing another package's `internal/`; forbid `payload` inside `payload/src/adapter`; forbid cycles.
- **Tests**: fixtures containing deliberate violations must fail the check.
- **Acceptance criteria**: passes on a clean repo, fails on every violation in the fixture set.
- **Risks**: false positives on type-only imports, handled with explicit `type-only` exceptions where legitimate.

## PB-004 - CI (GitHub Actions) - M

- **Purpose**: automatic verification of every change.
- **Dependencies**: PB-003
- **Files**: `.github/workflows/{ci,nightly}.yml`, `.github/actions/setup/action.yml`
- **Implementation**: `quality`, `test`, `build`, `pr-title` jobs (see `docs/contributing.md`); pnpm and turbo caching; `--affected` scoping for PRs; `concurrency: cancel-in-progress`; a nightly workflow skeleton.
- **Tests**: a test PR with a lint error and a bad title, confirming both jobs fail.
- **Acceptance criteria**: CI on an empty change completes in under 5 minutes.
- **Risks**: none (a remote turbo cache is not required for this task).

## PB-005 - Release tooling and community files - S

- **Purpose**: readiness to publish and to accept contributions.
- **Dependencies**: PB-002
- **Files**: `.changeset/config.json` (a fixed `@next-buildr/*` group), `.github/workflows/release.yml`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`
- **Implementation**: `changesets/action` (a Version PR, `--provenance` publishing, `access: public`); a `changeset-check` job; files per `docs/contributing.md`. Confirm `@next-buildr` npm scope availability and the trademark position before the first real publish.
- **Tests**: `changeset version` in dry-run bumps every package together; template YAML is valid.
- **Acceptance criteria**: the release workflow passes in dry-run mode.
- **Risks**: needs an npm organization and Trusted Publishing set up (an owner decision, tracked separately from this task).
