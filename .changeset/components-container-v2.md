---
'@next-buildr/components': major
---

`buildr/container` is now version 2 and absorbs the layout options of `buildr/stack` and `buildr/section`.

New props: `display` (`flex` by default, `block` shown as "Box", `grid`, `inline-flex`, `inline-block`), `as` (the element, `div` by default, or a landmark such as `section`, `header`, `main`, `nav`), `width` (adds `none`, "No limit"), `bleed` (a full-width background with the content kept to the column), `backgroundImage`, `role` and `ariaLabel`. It is now a landmark container (`contentCategories` gains `landmark`), its slot axis follows the computed layout, and it has the `size` style group.

Stored containers are migrated to `display: 'block'`, so they look as before. Stored `buildr/stack` and `buildr/section` nodes are rewritten into containers when a document is loaded (`replaces`, ADR-025):

- a stack becomes a flex column with no width limit, keeping its role and accessible name;
- a section becomes a `bleed` flex column with its element, width (`full` becomes `none`), background image (static or bound) and accessible name, and gets `gap: 0` where it had no gap, so spacing does not change. A section used to create a stacking context even without an image; a bleeding container does the same.

Removed exports: `Section`, `Stack`, `sectionFixtures`, `stackFixtures`, `SECTION_CONTAINERS`, `SECTION_ELEMENTS` and `STACK_ROLES`; the library registry no longer registers `buildr/section` or `buildr/stack`, and the built-in templates now use containers. Use `Container` (and `CONTAINER_DISPLAYS`, `CONTAINER_ELEMENTS`, `CONTAINER_ROLES`, `CONTAINER_WIDTHS`) instead. Stored documents are migrated, but a registry built without the library's `Container` cannot read them.

Containers now match the `landmark` content category (a container can sit where only landmarks were allowed), so a container can sit where only landmarks were allowed. The migration is one-way: save, publish and template hooks persist the migrated document, and an older build opens it read-only. Keep Payload versions enabled so a pre-migration revision can be restored.
