# Coding rules for AI agents

## TypeScript

- Strict mode, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` all enabled.
- No `any`. Use `unknown` plus a type guard or a Zod parse when the shape is genuinely unknown at that point.
- Prefer `Result<T, E>` over throwing for anything that represents bad *data* (validation failures, resolution failures). A thrown exception should mean "this is a programmer error", not "this input was invalid".
- Named exports everywhere, except in Next.js route files where a default export is required by the framework.
- Relative imports include the `.ts`/`.tsx` extension (the build's `rewriteRelativeImportExtensions` setting depends on this).

## Naming and file layout

- File names: `kebab-case.ts`. Component files: `PascalCase` for the exported component, `kebab-case.tsx` for the file itself. Functions and variables: `camelCase`.
- A client-only module ends in `*.client.tsx` and starts with `'use client'` as its first line — this is how the build and the boundary checks distinguish `runtime: 'shared'` from `runtime: 'client'` code (see [component-development.md](component-development.md)).
- Comments explain *why*, not *what* — the code should already say what it does.

## Dependencies

- No new runtime dependency without justification in the PR description.
- Inside `@next-buildr/core`, a new runtime dependency additionally requires an ADR (see [architecture-decisions.md](architecture-decisions.md)).

## Formatting and linting

- Biome handles both formatting and linting (`biome ci` in CI, `biome check --staged` as a pre-commit hook). Do not hand-format against its rules.

## Things that are always wrong here

- `eval`, `new Function`.
- `dangerouslySetInnerHTML` outside the one audited, sandboxed code path documented in [security.md](../security.md).
- Raw, unsanitized CSS or HTML built from user/CMS data.
- `postMessage(..., '*')`.
- A component fetching its own data instead of receiving it pre-resolved.
- A hard-coded, user-visible string in a site component or in the editor UI — route it through a `localizable` prop or the `messages` catalog (see [i18n.md](../i18n.md)).
