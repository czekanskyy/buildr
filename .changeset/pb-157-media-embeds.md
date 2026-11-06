---
"@next-buildr/core": minor
"@next-buildr/components": minor
---

PB-157 (ADR-028): `buildr/container` (version 3, identity migration) gets background video with a
poster, an overlay (`overlayTone`, `overlayOpacity`, `backgroundOverlay`), and `backgroundFit`,
`backgroundPosition` and `backgroundAttachment`. The background is decorative (`aria-hidden`), the
video is muted and looping, and reduced motion shows the still and unfixes the background. New
components `buildr/video` and `buildr/iframe` (https only, sandboxed with `allow-scripts`, no
referrer, lazy, a required title). A media prop may hold an external source,
`{ external: true, url }`, which `buildr/image`, `buildr/video` and the container background render
only when the URL is https, free of credentials and allowed by the host. `HostCapabilities` in
`@next-buildr/core` gets the optional `externalMediaHosts` and `iframeHosts` allowlists (a host and
its subdomains; absent means any https host, `[]` none). The default manifest budget is now 72 KB.
