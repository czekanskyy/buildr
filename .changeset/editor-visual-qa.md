---
"@next-buildr/editor": minor
---

Visual QA and accessibility pass (PB-131): the shared `Dialog` returns focus to the element that had it when it opened, the inactive breakpoint buttons are readable on the dark toolbar in the light theme, and the insert panel reports through the toast region (`useToast`) instead of a local status line, so `InsertPanel` must now be rendered inside `ToastProvider` (`EditorApp` already does).
