---
"@next-buildr/core": patch
---

`resolveQuerySpec` accepts a `page` written as text, such as `route.params.page` (route parameters are always strings); anything else that is not a whole number from 1 still gives page 1 with a warning (PB-063).
