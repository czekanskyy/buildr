---
"@next-buildr/react": minor
---

Add a host `capabilities` option (`{ authorCode?: boolean }`, fail-closed: only `true` enables it) to `renderDocument`, `DocumentRenderer`, `renderTree` (`RenderTreeOptions`) and `CanvasRuntime`, and expose it to components as `env.capabilities`. With `authorCode` on, a node's class names and validated attributes are added to its root element and its custom CSS is compiled; with it off they render nothing. `NodeRoot` now allows `title`, `role`, `rel`, `target`, `aria-*` and `data-*`. The canvas compiles motion rules and `@keyframes` (guarded by `prefers-reduced-motion`) so the editor preview shows animations.

`capabilities` also forwards `externalMediaHosts` and `iframeHosts` (ADR-028) to `env.capabilities`: arrays of strings only, trimmed, lowercased and bounded; a malformed list means no host.
