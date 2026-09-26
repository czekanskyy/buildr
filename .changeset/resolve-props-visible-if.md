---
"@next-buildr/core": minor
---

Add `resolveProps` and `resolveVisibility` (PB-025): the single entry point for turning a node's raw props into the values its component receives. `resolveProps(node, meta, ctx, { cache? })` resolves static (with `l10n` locale selection), binding and expression values, coerces, sanitizes and validates them against the prop kind, and falls back to the value's `fallback` and then the prop's `default`, returning JSON-serializable `{ props, diagnostics }` tagged with `nodeId`/`prop`. `resolveVisibility` evaluates `visibleIf` (fails closed). `isTruthy` is now exported from the expressions module.
