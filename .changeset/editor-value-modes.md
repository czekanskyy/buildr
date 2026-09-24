---
"@buildr/editor": minor
---

Value modes and the binding picker (PB-081): every prop that accepts data gets a Fixed / Data / Formula switch in the inspector. A field picker lists the paths of the data schema that fit the prop, with a format editor and a fallback; the formula editor parses and typechecks as you type, shows diagnostics and saves only valid formulas; a live preview resolves the value against sample data; a wrong path shows a red chip. `<InspectorDataProvider>` supplies the schema and sample context.
