---
"@next-buildr/core": minor
---

Add the expression lexer, parser and printer (PB-022): `parseExpression(source)` turns Buildr Expressions source into an `ExprNode` AST (`Literal | Path | Array | Unary | Binary | Logical | Conditional | Call`, each with a `[start, end)` span) using a hand-written lexer and a Pratt parser that matches the grammar in `docs/expressions.md`, with no dependencies. `parseTemplate(source)` does the same for `{{ expr }}` template mode, including `\{{` escapes.

Both return `Result<_, Diagnostic>` and never throw: a syntax error is a position-tagged `expr.syntax` diagnostic, and a breached limit (2000 characters of source, 500 tokens, AST depth 32) is `expr.limit`. `printExpression` / `printTemplate` print an AST back as normalized source such that `parse(print(ast))` equals `ast` ignoring spans (`stripSpans` is exported for that comparison).
