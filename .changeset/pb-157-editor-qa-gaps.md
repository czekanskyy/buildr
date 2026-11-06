---
"@next-buildr/editor": minor
---

Close the editor QA gaps: Style > Background gets Image and Video modes for components with the container background props (a mode switch removes the media the new mode does not use, as one undo step); the Structure panel gets a filter (ancestors of a match stay visible, with an empty state) and expand all / collapse all; the new optional `historyUrl` prop of `BuilderEditor` / `EditorApp` takes a link or a function and wins over the adapter; the media picker gets Library / Upload / URL sources with a drop zone for upload; the rich text editable no longer sits directly in a flex container. No document or prop shape changed.
