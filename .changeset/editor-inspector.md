---
"@buildr/editor": minor
---

The inspector (PB-079): `<Inspector />` shows the selected node's component props as controls (text, textarea, number, boolean, select, link, icon), grouped by `group`, with defaults and limits as hints, per-prop reset (`node.unsetProp`), Content / Style / Advanced tabs, and name, anchor and display-condition removal on Advanced. Typing coalesces into one undo step; a translatable prop writes to the language being edited (`locale`, `defaultLocale`). Bound and formula values show as chips (editing them is PB-081), and the Style tab takes a `renderStyle` slot (PB-082).
