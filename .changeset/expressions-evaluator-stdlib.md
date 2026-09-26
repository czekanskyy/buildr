---
"@next-buildr/core": minor
---

Add the expression evaluator and standard library (PB-023): `evaluate` / `evaluateTemplate` run a parsed expression or template against a `DataContext` with a 10,000-step budget, returning `Result<_, Diagnostic>` and never throwing. Data is read through `getPath` only; data-caused problems (division by zero, type mismatches) evaluate to `null` plus a warning collected via `options.diagnostics`. The allowlisted `stdlib` covers text, number, formatting (`formatNumber`, `formatCurrency`, `formatDate`, `plural` via `Intl`), list and logic functions. `compileExpression`, `compileTemplate` and `createCompileCache` provide parse-once handles and a caller-owned LRU cache.
