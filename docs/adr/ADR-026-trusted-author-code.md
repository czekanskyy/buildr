# ADR-026: Trusted author code

**Status:** Accepted (2026-11-06)

## Context

Adopters' editors are trusted people, not anonymous users. They need per-node CSS, class names and HTML attributes, and an HTML editing mode for Text. Hosts with less trusted editors still need the existing safe default.

## Options

1. **Keep only typed styles and rich text** — rejected: it cannot express the requested author customizations.
2. **Accept and render unrestricted code** — rejected: CSS and HTML can introduce injection, tracking and site-wide effects.
3. **Opt-in author fields with parsing, scoping and validation** — retains a safe default while enabling controlled customization.

## Decision

A host-controlled `capabilities.authorCode` permission defaults to off and is enforced at save and render, not merely hidden in the UI. When disabled, these fields have no effect and ADR-006 behavior remains. The Advanced tab offers custom CSS per node, CSS class names and validated HTML attributes. Text offers a code editor for HTML alongside basic rich text, with `mode: 'plain'|'rich'|'html'`.

Custom CSS is parsed by a real CSS parser, rejected on parse failure, and compiled into its own `@layer buildr.custom` with the node class as the nesting root. Reject `@import`, `@namespace`, external `url()` (allow only data: and same-origin or media-library URLs), `expression()`, `behavior`, `-moz-binding` and `</style`, including escaped or normalized equivalents. Reject constructs that cannot be safely scoped. Class names use a safe token alphabet and a bounded length. Attributes are allowlisted: `id`, `title`, `role`, `aria-*`, `data-*`, `rel`, and `target` with `rel` including `noopener`. Deny `on*`, `style`, `srcdoc`, `formaction`, and `href`/`src` with `javascript:` or `data:` schemes except images; URL-bearing values are validated before use.

HTML is parsed into an AST, sanitized against an element and attribute allowlist on editor save and again on render, and walked into React elements; unknown nodes are dropped with a diagnostic as in ADR-017. Never use `dangerouslySetInnerHTML`. A small HTML parser such as `parse5` is the candidate runtime dependency: it provides a standards-based AST without DOM globals. Core may receive it only after this ADR; dependency and boundary rules must be updated when implemented. Plain strings are stored for these author fields and validated by Zod at boundaries. Emit an audit diagnostic whenever custom code is present.

This proposes a narrow exception for these four fields to the AGENTS.md MUST NOT line:

> Use `eval`, `new Function`, `dangerouslySetInnerHTML`, or raw CSS/HTML coming from user data.

Only the raw CSS/HTML prohibition is relaxed; the execution and rendering prohibitions remain. It also supersedes ADR-006's statements for the custom CSS field only:

> **Free-form CSS blob per node** — rejected: no injection safety without a full CSS parser/sanitizer, no type safety, no design-token integration.

> No CSS injection is possible: the grammar never accepts `url()`, `calc()`, `;`, `@`, or `!important`.

Typed styles retain their grammar. This is also a limited exception to ADR-016's no-raw-HTML decision, not permission for custom JavaScript. The HTML string is an explicit exception to the canonical AST storage invariant; its sanitized AST is transient.

## Consequences

- Parsing and allowlisting reduce, but cannot eliminate, CSS/HTML security risk; maintain adversarial tests, size limits, diagnostics and parser updates. Node scoping must prevent selector escape and global effects.
- New optional fields need no rewriting of existing data; absence preserves existing behavior. ADR-014 still requires versioned migrations and fixtures for a document or component prop shape change, including Text's mode, with defaults preserving old rendering. Released migrations remain immutable.
- Hosts must enforce the capability on all write and render paths; audit diagnostics help find existing author code.
