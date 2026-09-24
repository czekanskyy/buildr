---
"@buildr/editor": minor
---

Preview mode (PB-091): `usePreview` saves the pending changes first (`preparePreview`), then shows the adapter's draft URL in a full-screen `PreviewOverlay` (Escape or a button exits) or in a new tab. A failed save or a non-web address shows a message instead of an out-of-date preview.
