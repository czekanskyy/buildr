---
"@next-buildr/editor": minor
---

Inspector controls for rich text, list and object props (PB-080). The rich text control is a Lexical editor (new dependencies `lexical` and `@lexical/*`, used only by the editor) whose output always passes `richTextSchema`; the list control adds, removes and reorders items within `min`/`max`; the object control edits named fields. Lists and objects nest through the exported `renderControl`.
