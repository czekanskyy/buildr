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

The AST node kinds are `Literal | Path | Array | Unary | Binary | Logical | Conditional | Call`, each carrying a `span: [start, end)` (UTF-16 offsets into the source) for editor error underlines. A printer (AST -> normalized source) supports round-trip tests.

Lexical details: `NUMBER` is `digits ('.' digits)? ([eE] [+-]? digits)?` (never negative — `-1` is a unary minus; a literal that overflows to `Infinity` is a syntax error); `STRING` is single- or double-quoted with the escapes `\\ \' \" \n \r \t \uXXXX`; `IDENT` is `[A-Za-z_][A-Za-z0-9_]*`; `true`/`false`/`null` are keywords. A `[ ... ]` index must be a non-negative integer, and `a['b']` is the same AST as `a.b`. Postfix steps on a path are folded into one `Path` node (`(a.b).c` is `a.b.c`); a step on any other primary (`(c ? a : b).x`, `[1, 2][0]`, `f(x).y`) gives a `Path` with an `object`.

The parser does not know the stdlib: any identifier followed by `(` parses as a `Call`, and the evaluator/typechecker enforce the allowlist and arity. Likewise it does not reject `__proto__`/`constructor` steps — those can never be read, because evaluation goes through `getPath`.

### Template mode

`parseTemplate` splits text from `{{ expr }}` interpolations (a `Template` of `Text | Interpolation` parts). A run of `n` backslashes directly before `{{` stands for `floor(n / 2)` literal backslashes, and the `{{` is literal text when `n` is odd (so `\{{` is the literal `{{`); a backslash anywhere else, and a stray `}}`, is plain text. A `}}` inside a string in an interpolation does not close it. A `{` immediately before an interpolation cannot be written (`{{{` opens at its first two braces); use `{{ "{" }}`.

## Semantics

- `==`/`!=` are strict (no coercion).
- `+` adds numbers, or concatenates when either operand is a string.
- Division by zero yields `null` plus a diagnostic.
- A path access on `null` yields `null` (implicit safe navigation).
- `&&`/`||` always return a boolean (unlike JavaScript, they never return an operand); `??` returns the left operand unless it is `null`. Truthiness: `null`, `false`, `0` and `""` are falsy, everything else (including `[]`) is truthy.
- `==`/`!=` compare lists and objects by content. `<`/`<=`/`>`/`>=` compare two numbers or two strings (by UTF-16 code unit); a `null` operand gives `false`.
- `+` with a string operand concatenates (`null` is empty text, a list or object is a type mismatch). `-`, `*`, `/`, `%` need numbers.
- **Missing data is not an error.** A `null` operand makes arithmetic `null`, and a `null` argument to a stdlib function whose parameter is not `any` makes the call `null`, both without a diagnostic. Data-caused problems — division by zero, a wrong operand or argument type, a non-finite result, an unreadable path, an invalid argument such as `round(n, 99)` — evaluate to `null` and emit a **warning** (`expr.division-by-zero`, `expr.type-mismatch`, `expr.not-finite`, `expr.path-invalid`, `expr.invalid-argument`).
- **Errors** (the result is an `Err` diagnostic with `details.start`/`details.end`): `expr.unknown-function`, `expr.arity`, and `expr.limit` (steps, nesting, text length, list size).
- `if` and `coalesce` evaluate only the arguments they need, so `if(x != 0, 10 / x, 0)` never divides by zero.

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

A hand-written lexer plus a Pratt parser (~400 LOC, zero dependencies), with position-tagged error messages: `parseExpression(source)` and `parseTemplate(source)` return `Result<Ast, Diagnostic>` and never throw. There is no error recovery — the first problem is reported as a `Diagnostic` with code `expr.syntax` (or `expr.limit`) and `details.start`/`details.end` giving the offending source range. `printExpression`/`printTemplate` emit normalized source with only the parentheses precedence requires.

## Validation

`typecheck(node, schema?, { accepts? })` (an expression or a template AST) returns `{ type, diagnostics }` without running anything. It infers the result type against the `DataSchema` (via `schemaAtPath`), checks function names, arity and argument types against the stdlib's own signatures (`params`, `returns`), checks operand types, and, when `accepts` (a `PropDef.accepts`) is given, that the result tag is one the prop can take. All problems are collected (not just the first) as span-tagged `error` diagnostics: `expr.unknown-path`, `expr.unknown-function`, `expr.arity`, `expr.type-mismatch`, `expr.result-type`.

Without a schema every path is `unknown`, and `unknown`/`null` are compatible with everything, so a missing schema never produces a false error. Parameters typed `any` (e.g. `count`, `len`) are checked at runtime only. Scopes a Loop introduces at runtime (`item`, `index`) must be added to the schema the caller passes. Wiring into `validateDocument` is PB-041.

## Execution and sandboxing

Evaluation is a tree-walking interpreter with a step budget. Data access goes exclusively through `getPath` (no prototype access is possible). Stdlib functions are pure TypeScript functions receiving already-evaluated arguments — there are no host objects, no method calls on values (`s.toUpperCase()` is not valid syntax), no regex (eliminating ReDoS), and no loops or lambdas, so termination is guaranteed by construction.

## API

`evaluate(ast, ctx, { maxSteps?, diagnostics? })` returns `Result<JsonValue, Diagnostic>` and `evaluateTemplate` returns `Result<string, Diagnostic>`; neither throws. Warnings are pushed to `options.diagnostics`. `compileExpression`/`compileTemplate` parse once and return a handle with `evaluate`; `createCompileCache(capacity)` returns an LRU cache owned by the caller (there is no module-level cache). `stdlib` exposes each function's parameter types and one-line `doc` for the typechecker and the formula editor.

Known gap: the grammar has no object literal, so the `opts` of `formatNumber` and the forms table of `plural` must come from data (`plural(n, labels.posts)`). An inline form needs an ADR-005 amendment.

## Limits

Source length <= 2000 characters (for a template, the whole source), <= 500 tokens (per expression), AST depth <= 32 (a left-leaning chain like `a + b + c + ...` adds one level per operator; parentheses and path steps add none), <= 10,000 evaluation steps, result text <= 10,000 characters, list operations <= 1000 elements.

## Why not an existing engine

JSON Logic is safe but unreadable for human authors. JSONata and Handlebars-style languages are too broad (lambdas, helpers, sometimes regex), widening the attack surface. CEL has good semantics and is the documented fallback (see ADR-005) if the language's required surface outgrows what a bespoke parser can reasonably own. A small custom language gives full control over error messages, autocomplete and typing against `DataSchema` — control an off-the-shelf engine would not give us.
