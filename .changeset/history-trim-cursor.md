---
"@buildr/core": patch
---

Fix history dirty tracking after the step limit trims the oldest entries: the floor of the history now gets a fresh `cursorId`, so undoing back to it is no longer mistaken for the document as it was before the trimmed steps.
