---
"@next-buildr/editor": minor
---

Add the Animations section to the Style tab (ready entrance effects, entrance, hover and scroll-reveal controls, ADR-027) and the author-code fields of ADR-026: custom CSS, CSS classes and HTML attributes on the Advanced tab, and a Basic / Rich / HTML code mode switch for Text. They are shown only when the host sets the new `capabilities={{ authorCode: true }}` prop (or `config.capabilities`); it is off by default, the fields then show a quiet "not enabled" note, and the commands refuse the writes anyway. The prop is passed into the command environment. `EditorStore` gains a read-only `authorCode` flag and `SegmentOption` an optional `disabled`. No document or prop shape changed.
