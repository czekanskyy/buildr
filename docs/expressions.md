# Expressions

See also [ADR-005](adr/ADR-005-expression-language.md).

Buildr Expressions is a small, purpose-built language for formatting, conditionals and simple computation inside prop values (`ExpressionValue`). It is not a general-purpose scripting language: there is no `eval`, no regex, no loops, no lambdas, and evaluation is guaranteed to terminate.

## Grammar (EBNF, lowest to highest precedence)

```
expr     := ternary
ternary  := nullish ( '?' expr ':' expr )?
nullish  := or  ( '??' or )*
or       := and ( '||' and )*
and      := eq  ( '&&' eq )*
eq       := cmp ( ( '==' | '!=' ) cmp )*
cmp      := add ( ( '<' | '<=' | '>' | '>=' ) add )*
add      := mul ( ( '+' | '-' ) mul )*
mul      := unary ( ( '*' | '/' | '%' ) unary )*
unary    := ( '!' | '-' ) unary | postfix
postfix  := primary ( '.' IDENT | '[' ( NUMBER | STRING ) ']' )*
primary  := NUMBER | STRING | 'true' | 'false' | 'null' | IDENT | call | '(' expr ')' | '[' ( expr ( ',' expr )* )? ']'
call     := IDENT '(' ( expr ( ',' expr )* )? ')'      // IDENT must be an allowlisted function
template := ( TEXT | '{{' expr '}}' )*                  // mode: 'template'; '\{{' is a literal
```

The AST node kinds are `Literal | Path | Array | Unary | Binary | Logical | Conditional | Call`, each carrying a `span: [start, end]` for editor error underlines. A printer (AST -> normalized source) supports round-trip tests.

## Semantics

- `==`/`!=` are strict (no coercion).
- `+` adds numbers, or concatenates when either operand is a string.
- Division by zero yields `null` plus a diagnostic.
- A path access on `null` yields `null` (implicit safe navigation).
- `&&`/`||` always return a boolean (unlike JavaScript, they never return an operand).

## Standard library (MVP)

| Group | Functions |
|---|---|
| Text | `upper, lower, capitalize, trim, truncate(s, n, suffix?), concat(...), replace(s, find, repl)` (literal, not regex), `slugify, len` |
| Number | `round(n, digits?), floor, ceil, abs, min(...), max(...), clamp(n, lo, hi)` |
| Formatting | `formatNumber(n, opts?), formatCurrency(n, currency), formatDate(d, 'short'\|'medium'\|'long'\|'iso'), plural(n, { one, few, many, other })` (backed by `Intl.PluralRules`, correctly handling e.g. Polish plural categories) |
| Lists | `count, first, last, join(list, sep), includes(list, v), slice(list, start, end?)` |
| Logic | `if(c, a, b), coalesce(...), isEmpty(x)` |

There is no `now()` and no source of randomness — evaluation is fully deterministic, which is what makes caching and SSR/CSR parity safe.

## Parser

A hand-written lexer plus a Pratt parser (~400 LOC, zero dependencies), with position-tagged error messages.

## Validation

`typecheck(ast, DataSchema)` infers a result type against the schema, checks function names/arities against the stdlib's own type signatures, and compares the inferred type to the target `PropDef.accepts`.

## Execution and sandboxing

Evaluation is a tree-walking interpreter with a step budget. Data access goes exclusively through `getPath` (no prototype access is possible). Stdlib functions are pure TypeScript functions receiving already-evaluated arguments — there are no host objects, no method calls on values (`s.toUpperCase()` is not valid syntax), no regex (eliminating ReDoS), and no loops or lambdas, so termination is guaranteed by construction.

## Limits

Source length <= 2000 characters, <= 500 tokens, AST depth <= 32, <= 10,000 evaluation steps, result text <= 10,000 characters, list operations <= 1000 elements.

## Why not an existing engine

JSON Logic is safe but unreadable for human authors. JSONata and Handlebars-style languages are too broad (lambdas, helpers, sometimes regex), widening the attack surface. CEL has good semantics and is the documented fallback (see ADR-005) if the language's required surface outgrows what a bespoke parser can reasonably own. A small custom language gives full control over error messages, autocomplete and typing against `DataSchema` — control an off-the-shelf engine would not give us.
