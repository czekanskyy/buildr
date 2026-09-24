---
"@buildr/core": minor
---

Add `node.setProp` / `node.unsetProp` (PB-035): set or remove a prop's `Value` validated against its `PropDef` (static kind validators, binding path syntax, expression syntax, `bindable` / `localizable` rules, content locks), including per-language translations via `locale`. Adds the optional `CommandHandler.mergeKey` used for history coalescing.
