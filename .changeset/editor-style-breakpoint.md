---
"@next-buildr/editor": patch
---

`EditorApp` passes the screen size chosen in the toolbar to the style inspector, so a style set while editing "Mobile" is written to that breakpoint instead of the base layer (PB-112).
