# ADR-004: Dynamic binding model

**Status:** Accepted

## Context

Content must be sourceable from CMS data (post title, product price, author name, …) without multiplying the component catalog with `DynamicHeading`, `DynamicImage`, `DynamicPrice`, etc. — which would double the number of components, fragment the editing experience, and make every future component need a "dynamic twin".

## Options

1. **`Dynamic*` component variants** — rejected: doubles the catalog, and a component's "dynamic-ness" becomes a structural (node type) decision instead of a per-prop one.
2. **A binding map attached to the node**, separate from `props` — adds an indirection layer and a second place to look for "what is this prop's value", complicating validation and the inspector.
3. **`Value<T>` as the type of every prop** — each prop is one of `static | binding | expression`, decided per-prop, per-instance.

## Decision

Every prop declared as `bindable` in its `PropDef` accepts a `Value<T>`: `StaticValue<T> | BindingValue<T> | ExpressionValue<T>`, discriminated by an explicit `kind` field (chosen over overloading `type`, which already names the node's component type). `StaticValue` is deliberately wrapped rather than being a bare value, so a `switch (value.kind)` is the single dispatch point everywhere a value is resolved, with no ambiguity when parsing untrusted JSON.

## Consequences

- Any prop can become dynamic if its schema allows it — the editor's Static/Dynamic/Formula switch is generic UI, not per-component code.
- A single `resolveProps` resolver in `@next-buildr/core` handles all three kinds for every component; components never see `Value<T>`, only resolved values.
- Slightly larger storage per prop (~20 bytes overhead for the `kind` wrapper) — accepted as negligible against the clarity gained.
- There is no separate "UPDATE_BINDING" command — setting a binding is just `node.setProp` with a `BindingValue`.
