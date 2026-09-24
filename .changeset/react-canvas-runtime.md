---
"@buildr/react": minor
"@buildr/core": patch
---

Adds `CanvasRuntime` to `@buildr/react/canvas`: the canvas's handshake, document replica with version-gap resync, per-node rendering (`renderNodeAt`, `instrument.lazyChild`), per-node error boundaries, placeholders and diagnostics reporting (PB-067). The protocol's patch limit now matches `applyDocumentPatches` (10 000).
