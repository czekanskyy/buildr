---
"@buildr/core": minor
---

Add the accessibility validator (PB-042): `runA11y(doc, registry, { config?, locales?, theme?, rules? })` and the `A11yRule` / `A11yContext` framework, with the MVP rules `image-alt`, `heading-order`, `empty-heading`, `button-name`, `link-name`, `link-href`, `form-label`, `form-submit`, `nested-interactive`, `duplicate-anchor`, `list-structure`, `landmark-unique`, `accordion-structure`, `new-tab-link` and `missing-translation` (info). Content rules run once per configured language and tag each issue with `locale`. `A11yConfig` has `expectH1` (`'layout' | 'document'`), `disabledRules` and `publishPolicy`. `heading-order` offers a `node.setProp` fix. Values bound to data are never judged.
