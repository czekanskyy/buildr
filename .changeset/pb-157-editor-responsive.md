---
"@next-buildr/editor": minor
---

PB-157: the editor no longer refuses to open below 1024px. The default of `minViewportWidth` changed
from 1024 to 320, so the "use a computer" notice only appears on very narrow windows; set `1024`
to keep the old gate. The default `tablet` breakpoint width changed from 820 to 768
(`DEFAULT_BREAKPOINTS`). Below 1100px the panels become sheets, and the status bar counts notes next
to errors and warnings.
