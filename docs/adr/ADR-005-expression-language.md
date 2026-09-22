# ADR-005: Expression language

**Status:** Accepted

## Context

Beyond simple field bindings, authors need formatting, conditionals and small computations (formatted prices, pluralized counts, visibility conditions) without writing arbitrary JavaScript, which would be a direct code-injection risk in a multi-tenant CMS.

## Options

1. **No expression support** — pushes every formatting/condition need into new bespoke components; rejected as unsustainable.
2. **`eval`/`new Function`** — rejected outright on security grounds.
3. **JSON Logic** — safe, but unreadable for non-technical authors and painful to surface good error messages/autocomplete for.
4. **JSONata / Handlebars-style template languages** — too broad (lambdas, regex, arbitrary helpers), which widens the attack surface and the surface we'd need to sandbox.
5. **CEL (Common Expression Language)** — good semantics and an existing spec, but pulls in an external engine we don't fully control for error messages, typing against our own `DataSchema`, and IDE-grade diagnostics.
6. **A small, purpose-built expression language** — hand-written lexer + Pratt parser + tree-walking interpreter, ~400 LOC, zero dependencies, an explicit function allowlist, no regex, no loops, no lambdas, so evaluation always terminates.

## Decision

Ship a **small custom expression language** ("Buildr Expressions"): arithmetic, comparison, boolean logic, ternary, safe path access, array literals, and calls into an explicit allowlisted stdlib (text, number, date/currency formatting, list helpers, `plural()` with correct ICU pluralization). No `eval`, no regex, no prototype access, no loops. Resource limits on source length, token count, AST depth and evaluation steps. **CEL is the explicit fallback** if the language's needed surface grows beyond what a bespoke parser can reasonably own (see the "risks" note in the backlog).

## Consequences

- Full control over error messages, source spans (for editor squiggles), and static typing against `DataSchema`.
- Deterministic evaluation: same document + same data ⇒ same output, safe to cache, safe for SSR/CSR parity. No `now()`, no randomness.
- ~1–2k LOC of language implementation to own and test (property-based + fuzz tests are mandatory, see `docs/testing.md`).
- Any grammar change goes through this ADR being amended/superseded — it is not a place for ad hoc feature creep.
