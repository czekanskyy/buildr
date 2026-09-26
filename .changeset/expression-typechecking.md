---
"@next-buildr/core": minor
---

Add expression and template typechecking (PB-024): `typecheck(node, schema?, { accepts? })` infers the result type of an expression or `{{ }}` template against a `DataSchema` and reports span-tagged diagnostics for unknown paths and functions, wrong arity, operand/argument type mismatches and a result the target `PropDef.accepts` cannot take. Every stdlib function now declares its `returns` type.
