---
"@buildr/editor": minor
---

Sample data for templates (PB-090): `SamplePicker` lists the adapter's `listSamples`, tells the canvas which entry to render with (`CanvasHost.setContextRef`) and remembers the choice per document in `localStorage` (failures ignored). `DocumentAdapter.getContext` takes an optional `{ sampleId }`.
