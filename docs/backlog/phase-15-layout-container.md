# Phase 15: One layout component

`buildr/container` becomes the only layout box. `buildr/section` and `buildr/stack` are retired through the replacement migrations of [ADR-025](../adr/ADR-025-retiring-a-component-type.md), which also covers stored documents, clipboard fragments and agent working copies. The insert panel shows readable category labels.

## PB-148 - Layout: Container only (retire Section and Stack), Container display modes, Insert category labels - L

- **Purpose**: one component for layout boxes, with the options authors need (display mode, landmark element, width limit, full-bleed background), and no loss of existing content.
- **Dependencies**: none open (builds on the migration system of PB-011 and ADR-014).
- **Files**: `docs/adr/ADR-025-retiring-a-component-type.md`, `docs/migrations.md`; `packages/core/src/{migrations,document/tree.ts,templates,registry,dnd,schema/kinds/select.ts}`; `packages/react/src/define`; `packages/components/src/{container,section,stack,templates,gallery.ts,registry.ts,test-kit.tsx}`; `packages/editor/src/{clipboard,app,panels/insert,panels/inspector/controls,messages}`; `packages/mcp/src`; `packages/payload` tests; `packages/test-utils`; `apps/playground`, `apps/example-next-payload` (wiring and tests); `docs/`.
- **Implementation**:
  - Core: `replaces` replacement migrations in `migrateComponents` with group-atomic planning, `migrateFragment`, `registryVersions` / `withRegistryVersions`, a `versions` argument for `fromTree` and `instantiateTemplate`, optional `optionLabels` on `p.select` (also in the manifest).
  - React: `defineComponent` accepts `replaces`; `createRegistry` merges it and throws on a duplicate or a still-registered retired type.
  - Components: Container v2 with `display` (flex default, block shown as "Box", grid, inline-flex, inline-block), `as` (div, section, header, footer, main, aside, nav, article), `width` (none, sm, md, lg, xl), `bleed`, `backgroundImage` (bindable media), `role`, `ariaLabel`; a 1 -> 2 step that writes `display: 'block'` so existing containers do not change; replacements `buildr/stack` -> container and `buildr/section` -> container; remove both components and update templates, gallery and fixtures.
  - Editor: category headings "UI" and "CMS" (en and pl), the select control shows `optionLabels`, paste migrates fragments through an optional `migrations` prop and refuses outdated content with a message, insert and drag fragments carry registry versions.
  - MCP: file and memory backends take `migrations`; without them an old document is read-only with a reason.
  - Payload: stored documents with section and stack nodes are migrated on read and persisted migrated on save; a refused migration leaves the stored row unchanged.
- **Tests**: migration cases (rewrite, mixed nodes, order independence, container@1 together with stack@1, container@3 with stack@1 blocked, version mismatch, idempotence, no input mutation, same reference when unchanged, `migrateFragment` parity); component fixtures 1 -> 2 and replacements (full, lg, image static and bound, `as: 'main'`, localized `ariaLabel`, gap and display matrix) that pass `validateDocument` and the accessibility checks against the default registry; SSR snapshot and visual baselines unchanged for existing templates; editor paste with and without `migrations`; MCP backends with and without `migrations`; Payload write and read-only fallback.
- **Acceptance criteria**:
  - No `buildr/section` or `buildr/stack` remains in the registry, templates, gallery or docs, and every stored document, clipboard fragment and template that contained them opens as a container with the same appearance.
  - A failed migration never drops content: the document is read-only with `component.replacement-version-mismatch`, `component.missing-version`, `component.newer-than-registry` or `component.migration-chain-invalid`, and a write is refused without changing the stored row.
  - Inserting a fragment built from the registry never fails with `command.component-version-mismatch`.
  - The insert panel shows "UI" and "CMS" headings in both languages; the display select shows "Box" for `block`.
  - Changesets: components major, core, react, editor and mcp minor, test-utils patch; `pnpm test`, `typecheck`, `lint`, `check:boundaries` and the e2e and visual suites pass.
- **Risks**: visual drift (mitigated by the 1 -> 2 step and unchanged baselines); stored documents rewritten permanently (the migration is one-way, keep Payload versions enabled, see ADR-025); a host that does not pass `migrations` to the editor refuses old clipboard content.
- **Status**: Done.
