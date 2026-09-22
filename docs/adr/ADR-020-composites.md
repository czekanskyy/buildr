# ADR-020: Composite components

**Status:** Accepted

## Context

Ready-made sections (Hero, Pricing, FAQ, …) need to give users a fast starting point without becoming opaque, non-editable "magic widgets" that can't be customized once inserted.

## Options

1. **Closed, monolithic widgets** (a single component that internally renders a whole hero section) — fast to build, but users can't rearrange, remove or add elements inside them; rejected as contrary to the product's editability requirement.
2. **Linked/synced symbols** (Webflow Components / Figma-style: instances stay connected to a master, edits propagate) — powerful, but a materially larger engineering effort (override tracking, propagation rules, detach semantics) than MVP needs.
3. **Detached template instances**: a `TemplateDefinition` whose `tree` is an ordinary subtree of real, registered components; instantiating it (`instantiateTemplate`) produces a normal, fully independent, fully editable subtree with fresh node IDs.

## Decision**

Composites are **detached template instances** built entirely from ordinary registered components — no bespoke "Slot" component; template regions map onto normal component slots plus an optional `region` marker that permits editing inside an otherwise `lock.structure`-protected subtree. Linked/synced symbols (option 2) are deferred to v0.3 as an additive `buildr/symbol` node type; the detached model does not block adding it later.

## Consequences

- Every inserted Hero/CTA/Pricing section is, from the moment it's inserted, an ordinary, fully editable part of the document — no special-casing in commands, validation, or rendering.
- No "propagate template change to existing instances" feature exists in MVP or v0.2 — each instance is independent once inserted. This is a known, explicit trade-off, not an oversight.
- Optional `lock.structure` + `region` gives template authors a way to protect a section's overall shape (e.g. "don't let someone delete the Hero's image column") while still allowing content edits — enforced by `canInsert`/`canMove`/`canRemove`, not by UI convention alone.
