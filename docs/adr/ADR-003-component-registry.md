# ADR-003: Component registry

**Status:** Accepted

## Context

Components must be extensible by application authors (`registerComponent`-style ergonomics) without modifying `@next-buildr/core`, must work identically inside React Server Components and inside tests, and their *metadata* (for the editor's palette, inspector and drag-and-drop rules) must be usable without ever importing the component's React implementation.

## Options

1. **Global mutable registry** (module-level `Map` populated by side-effecting `registerComponent()` calls) — the common React-ecosystem pattern, but breaks under RSC (multiple concurrent requests, multiple module instances), breaks test isolation, and prevents multiple registries coexisting (e.g. playground vs. example app).
2. **Immutable, explicitly-constructed registry**, built once via `createRegistry({ components, templates })` and passed down explicitly.
3. **Filesystem auto-discovery** (scan a `components/` directory) — implicit, hard to reason about for agents, and awkward across the RSC/client boundary.

## Decision

`createRegistry()` returns an **immutable** registry (`.extend()` returns a new one). Metadata (`ComponentMeta`, serializable) is strictly separated from implementation (`render`, `runtime`, `migrations`, not serializable). The editor never imports component implementations — it consumes a `RegistryManifest`, a JSON projection of the metadata produced by `toManifest()`.

## Consequences

- "Registering" a custom component means writing `defineComponent({ ...meta, render: MyView })` and adding it to the array passed to `createRegistry` in the consuming application — no mutation of shared module state, and no change to `@next-buildr/core`.
- The registry works identically in RSC, in the browser canvas, and in unit tests.
- Custom editor controls for custom prop kinds require an explicit extension point (`editor plugin API`), deferred to v0.2 — not needed for MVP because all MVP prop kinds ship built-in.
