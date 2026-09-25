---
"@buildr/editor": minor
---

Feedback surfaces (PB-129): one toast region (`ToastProvider`, `useToast`) replaces the separate clipboard, preview and external-changes notices; dialogs get a header with a close icon button, a scrollable body and a right-aligned footer (`Dialog` takes `footer` and `hideClose`); the issues panel groups findings by severity with severity and component icons; the publish dialog shows its counts as icon badges. `ClipboardProvider` and `PersistenceProvider` now need a `ToastProvider` above them.
