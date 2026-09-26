---
"@next-buildr/editor": minor
---

Design tokens, base styles and Inter (PB-119): the stylesheet is split into `styles/{tokens,base,shell,primitives,panels}.css` (the public `@next-buildr/editor/styles.css` path is unchanged; the published file is the flattened partials). New identity: spacing, type, radius, control, elevation and motion scales, every colour role in light and dark (including `--bd-accent-soft`, `--bd-surface-hover`, `--bd-warning` and a dark toolbar), `color-scheme` and themed scrollbars, self-hosted Inter 400/500/600 (latin + latin-ext, OFL licence in `dist/fonts/`). `--bd-space-N` is renumbered (2/4/6/8/12/16/20/24/32px). Hosts that overrode `--bd-*` tokens should review them.
