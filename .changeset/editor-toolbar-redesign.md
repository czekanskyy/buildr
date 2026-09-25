---
"@buildr/editor": minor
---

Toolbar redesign (PB-123): three zones (link back, title and status pill; segmented icon breakpoint control and zoom menu; undo/redo, save status, pickers, Preview, Publish and a more menu). `Toolbar` takes `status`, `zoom`, `onZoomChange` and `pickers`. The more menu holds the theme switch (light / dark / system, remembered in localStorage, hidden when the host sets `config.theme`), the shortcuts help and whatever no longer fits the row (measured with a `ResizeObserver`). Menus, popovers and tooltips render inside the editor root and inherit its theme.
