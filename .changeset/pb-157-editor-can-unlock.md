---
"@next-buildr/editor": minor
---

PB-157: new optional `canUnlock` prop on `BuilderEditor` and `EditorApp` (the host's permission to
weaken a lock). Without it a locked block stays locked: the layers panel says unlocking is not
allowed, and the locked toast no longer sends the author to the Structure panel. `EditorStore`
gains a read-only `canUnlock` flag.
