---
"@next-buildr/editor": minor
---

Canvas stage (PB-124): the canvas iframe's height compensates for the zoom scale so the page always fills the visible stage, the page sits centred on the stage with padding, a shadow and a width label ("Tablet · 820px"), scale changes animate (not with reduced motion), and the connecting and error screens are cards with an icon and a title. New pure `stageMetrics` helper (exported from `canvas-frame.tsx`).
