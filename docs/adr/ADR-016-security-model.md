# ADR-016: Security model

**Status:** Accepted

## Context

The system renders untrusted-ish content (CMS-editable by potentially many users, in a multi-tenant setting) into real web pages, and synchronizes structured data across an iframe boundary. It must be safe by default without depending on every component author remembering to sanitize input.

## Options

1. **Allow raw HTML/custom JS from day one, sanitize on render** — rejected for MVP: HTML sanitization is a notoriously leaky abstraction, and "custom JS" execution is very hard to make safe without a real sandbox.
2. **No raw HTML/custom JS in MVP; validate every external input at its boundary; add sandboxed embeds/custom HTML later behind a dedicated, opt-in permission.**

## Decision**

MVP ships **no raw HTML and no custom JavaScript execution path**. Every external input (document JSON from the database, clipboard fragments, `postMessage` payloads, HTTP request bodies) is validated against a Zod schema at its boundary. Rich text is a constrained, allowlisted subset of Lexical's JSON, walked into React elements — never `dangerouslySetInnerHTML`. URLs go through `sanitizeUrl` (protocol allowlist: `http`, `https`, `mailto`, `tel`, relative, `#anchor`). The expression language has no `eval`/`Function`, no prototype access, no regex (see ADR-005). `postMessage` never uses `'*'` as target origin, and both sides validate `event.origin`, `event.source` and a per-session nonce. All Payload Local API calls run with `overrideAccess: false` and an explicit `user`. When a "Custom HTML" embed is added in v0.3, it will run inside a `sandbox="allow-scripts"` (no `allow-same-origin`) `srcdoc` iframe, gated by a dedicated `unsafeEmbed` permission.

## Consequences

- The MVP attack surface for XSS/CSS-injection/JS-injection is deliberately small, at the cost of not supporting arbitrary embeds/custom code until v0.3.
- Every boundary-crossing data path has a corresponding, mandatory validation test (`docs/testing.md`, "Security" row) — this is not optional coverage.
- Access control is never delegated to the client: the editor UI hides actions the user can't perform, but the server is the actual enforcement point in every case.
