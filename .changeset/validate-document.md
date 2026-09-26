---
"@next-buildr/core": minor
---

Add `validateDocument(input, { registry, theme?, locales?, dataSchema?, limits? })` (PB-041): one aggregate check of the envelope and limits, invariants, component versions, nesting of the existing structure (slot allow/deny, parents, required ancestors, slot min/max), every prop (values, translations, `l10n` keys against the configured languages, bindability), bindings and expressions against the data schema, `visibleIf`, and styles. Each issue is a `Diagnostic` plus `blocking`; `ok` is false only for blocking issues. `checkPlacement` is extracted from `canInsert` so both apply the same nesting rules.
