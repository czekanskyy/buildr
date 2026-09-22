# Extending Buildr

There is no single "plugin" mechanism — extension happens at well-defined points, each documented elsewhere. This page is the index.

| You want to add... | Extension point | Docs |
|---|---|---|
| A custom component | `defineComponent` plus registration in `createRegistry` in the consuming application | [component-registry.md](component-registry.md), [ai/component-development.md](ai/component-development.md) |
| A custom template (composite) | `defineTemplate` | [templates.md](templates.md) |
| A custom expression function | An allowlisted addition to `expressions/stdlib` (core-owned; requires an ADR-005 amendment, not a per-app extension in MVP) | [expressions.md](expressions.md) |
| A custom rich text node converter | An entry added to `richTextConverters` | [renderer.md](renderer.md#loop-slots-rich-text) |
| A custom `DataSource` | Implement the `DataSource` interface, validated by the shared contract test suite | [dynamic-bindings.md](dynamic-bindings.md#lists-and-queries-loop-query) |
| A custom inspector control (custom prop kind) | The editor plugin API (v0.2 — not available in MVP; all MVP prop kinds ship built-in) | [component-registry.md](component-registry.md#props-dsl-p) |
| A Payload-specific behavior | `buildrPlugin()` options | [payload.md](payload.md) |

There is no filesystem auto-discovery mechanism and no global mutable registry (see [ADR-003](adr/ADR-003-component-registry.md)) — every extension point above is an explicit, typed function call in application code.
