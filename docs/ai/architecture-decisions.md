# Architecture decisions

The authoritative list lives in [`../adr/README.md`](../adr/README.md); each ADR follows the same template (Status, Context, Options, Decision, Consequences).

## Index

001 [Monorepo tooling](../adr/ADR-001-monorepo.md) - 002 [Canonical document AST](../adr/ADR-002-canonical-ast.md) - 003 [Component registry](../adr/ADR-003-component-registry.md) - 004 [Dynamic binding model](../adr/ADR-004-dynamic-binding.md) - 005 [Expression language](../adr/ADR-005-expression-language.md) - 006 [Styling model](../adr/ADR-006-styling-model.md) - 007 [Responsive model](../adr/ADR-007-responsive-model.md) - 008 [Renderer architecture](../adr/ADR-008-renderer-architecture.md) - 009 [Editor architecture](../adr/ADR-009-editor-architecture.md) - 010 [Payload integration](../adr/ADR-010-payload-integration.md) - 011 [Next.js integration](../adr/ADR-011-nextjs-integration.md) - 012 [Undo/redo model](../adr/ADR-012-undo-redo.md) - 013 [Command system](../adr/ADR-013-command-system.md) - 014 [Schema migrations](../adr/ADR-014-schema-migrations.md) - 015 [Iframe preview](../adr/ADR-015-iframe-preview.md) - 016 [Security model](../adr/ADR-016-security-model.md) - 017 [Rich text format](../adr/ADR-017-rich-text-format.md) - 018 [Data fetching](../adr/ADR-018-data-fetching.md) - 019 [Deployment topology](../adr/ADR-019-deployment-topology.md) - 020 [Composite components](../adr/ADR-020-composites.md) - 021 [Build & package format](../adr/ADR-021-build-package-format.md) - 022 [License](../adr/ADR-022-license.md) - 023 [Localization](../adr/ADR-023-localization.md)

## Proposing a new ADR

1. Confirm the decision genuinely isn't covered by an existing ADR (read the index above first).
2. If you're a coding agent mid-task and hit a decision point not covered here: **stop**. Do not implement your own guess. Open the PR (even a draft/partial one) with a `needs-decision` label and describe the question and the options you see. Do not merge speculative architecture.
3. A new ADR follows the standard template: Status (`Proposed` until a maintainer accepts it), Context, Options (with a real trade-off for each, not just the chosen one), Decision, Consequences.
4. A decision that reverses an earlier one adds a *new* ADR and marks the old one `Superseded by ADR-0xx` — ADRs are never edited to say something different after acceptance.
