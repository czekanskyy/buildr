---
"@next-buildr/editor": minor
"@next-buildr/react": patch
---

Rebuild the editor UI to match the v2 design template: three-zone toolbar, Blocks / Structure left panel, collapsible inspector and style sections, empty page, shortcuts and help dialog, panel rails, in-stage issues drawer and toasts. The canvas overlay chip in `@next-buildr/react` is restyled. The editor now requires canvas protocol v2, so it must be paired with matching `@next-buildr/core` and `@next-buildr/react` releases (the protocol change itself is described in the core and react changesets). The `uiLocale` and `minViewportWidth` defaults and the `canUnlock` prop are covered in their own changesets. No document or prop shape changed.
