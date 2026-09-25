---
'@buildr/mcp': minor
---

Add agent-facing serialization (PB-135), exported from `@buildr/mcp`: a token-efficient text and JSON outline of a (sub)tree (`renderOutline`, `outlineToJson`), node detail with every prop as a `Value` (`describeNode`), component descriptions with a minimal valid example and its placement (`describeComponent`), a described tree input schema with registry-aware validation (`createTreeInputSchema`, `parseTreeInput`, `treeInputJsonSchema`), and error rendering that turns rule and command rejections into one actionable sentence with the nearest valid alternatives (`explainReason`, `explainCommandError`, `explainSessionError`).
