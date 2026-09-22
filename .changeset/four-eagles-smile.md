---
"@buildr/core": minor
---

Add `ComponentMeta`, slots, and the content model (PB-014): the `ComponentMeta` shape (props, slots, `contentCategories`, `parents`, `capabilities`, `styles.groups`, `a11y`, `editor`, `formField`, `defaults`, `runtime`), `Matcher` (an exact component type or a `#category` reference) with `isCategoryMatcher`/`categoryOf`/`isValidContentCategory`/`matchesType`, and `validateComponentMeta(meta)` — checking type-name shape, prop defaults against their own kind's validator, slot consistency (names, `min`/`max`, and every slot reference in `defaults.slots`/`editor.emptySlotText`), and that every `Matcher` used in the metadata is well-formed.
