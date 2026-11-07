---
"@next-buildr/components": minor
"@next-buildr/editor": patch
---

PB-160c: `buildr/map` uses the Google Maps Embed API in place mode, with
click-to-load on by default: no provider request before the consent click, and
the canvas never loads a provider. Without a valid key, or when the frame host
is not allowed by `iframeHosts`, it renders only a link. Requires `Platform.maps`
(the react/next minor releases in `pb-160c-platform-maps.md`). Starts at version 1,
so no migration is needed. The editor knows its Polish label and lists Map in
the media section of the Blocks tab.
