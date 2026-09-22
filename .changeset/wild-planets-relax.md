---
"@buildr/core": minor
---

Add the `Value<T>` type, schema, and helpers (PB-013): `StaticValue`/`BindingValue`/`ExpressionValue`/`Value<T>`, `FormatSpec`, `LocaleCode`, `LocaleConfig`; `valueSchema(inner)` and `formatSpecSchema` (Zod, discriminated on `kind`); `s()`, `bind()`, `expr()`, `withTranslation()`, and the per-kind guards `isStaticValue`/`isBindingValue`/`isExpressionValue`. Narrows `PageNode.props` from `unknown` to `Value`.
