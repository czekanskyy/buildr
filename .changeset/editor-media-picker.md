---
"@buildr/editor": minor
---

Media picker (PB-089): `MediaPicker` (searchable grid, type filter narrowed by the prop's `accept`, paging, upload that requires alternative text, retryable errors), `MediaLibraryProvider` (the adapter's `media` and the collection a `MediaRef` names), `MediaControl` for `p.media()` props (thumbnail with alt, choose / replace / remove) and `toMediaRef` / `parseMediaRef`. **Breaking for adapters**: `DocumentAdapter.media.upload` now receives the alternative text: `upload(file, alt)`.
