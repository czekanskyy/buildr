## Task

<!-- Link the backlog task, e.g. PB-008. Every PR should map to exactly one task. -->

PB-xxx

## Summary

<!-- What changed and why. Don't just repeat the PR title. -->

## Checklist

- [ ] Tests added/updated for this change ([`docs/testing.md`](../docs/testing.md), [`docs/ai/testing-rules.md`](../docs/ai/testing-rules.md))
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass locally
- [ ] `pnpm check:boundaries` passes
- [ ] A changeset is included (`pnpm changeset`) if this changes a published package's public API
- [ ] Docs updated for the area this PR touches
- [ ] Accessibility checked (only if this is a UI change — keyboard navigation, focus order, ARIA)
- [ ] Screenshots or a short clip attached (only if this is a UI change)
- [ ] A migration is included (only if this changes the document schema or a component's prop schema — see [`docs/migrations.md`](../docs/migrations.md))

## Open questions

<!-- Anything that needs a decision before merge. Label the PR `needs-decision` or `blocked` if applicable. -->
