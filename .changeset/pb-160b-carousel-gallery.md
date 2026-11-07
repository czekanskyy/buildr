---
"@next-buildr/components": minor
"@next-buildr/editor": patch
---

PB-160b: four new blocks. `buildr/carousel` provides a scroll-snap track with optional
controls and opt-in autoplay (off by default, never under reduced motion, with a pause
control), and `buildr/carousel-slide` holds its content. `buildr/gallery` provides an
image grid, aspect ratios and an optional native-dialog lightbox; `buildr/gallery-item`
holds each image and caption. All four start at version 1, so no migration is needed.
The editor knows their Polish labels, and the media section of the Blocks tab lists
Carousel and Gallery. Slides and items cannot be inserted or moved individually
in the palette (`insertable: false`).
