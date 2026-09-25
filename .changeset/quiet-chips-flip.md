---
"@buildr/react": minor
---

Canvas overlay polish (PB-130): accent hover and selection outlines, a label chip (component label and node name) that flips inside the node at the viewport edge, accent drop lines and "inside" highlights, and dashed empty-slot placeholders, all from a fixed `--buildr-*` variable set inside the canvas. `createOverlay` accepts an optional `labelOf`; `computeBoxes` an optional third argument. No protocol change.
