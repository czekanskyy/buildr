---
"@buildr/core": minor
---

Add `DataType`/`DataField` and the `p.*` props DSL (PB-012): the MVP prop kinds (`text`, `textarea`, `richText`, `number`, `boolean`, `select`, `link`, `media`, `icon`, `list`, `object`, `listSource`), each producing a fully JSON-serializable `PropDef` with its own default, `accepts` (binding-compatible `DataType` tags) and `localizable` default; `ResolvedProps<P>`/`ResolvedPropValue` infer a component's resolved prop types (capped at two levels of `list`/`object` nesting); and `validatePropValue(def, value)` validates a value against its prop kind.
