---
"@next-buildr/editor": minor
---

The canvas host (PB-076): `createCanvasHost` and `<CanvasFrame />` mount the canvas iframe with a nonce, verify `manifestHash` and the protocol version at the handshake, answer every `canvas:hello` with an idempotent `editor:init` (so a reloading canvas loses nothing), batch patches per animation frame, resync with `doc:set`, keep the breakpoint, zoom, locale, context and mode, show status and diagnostic error screens, and map what the canvas reports onto store actions.
