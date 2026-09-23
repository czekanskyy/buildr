---
"@buildr/core": minor
---

Add URL/string sanitization and the rich text format (PB-020): `sanitizeUrl(url)` validates a URL against the scheme allowlist from `docs/security.md` (`http`, `https`, `mailto`, `tel`, plus relative paths and `#anchor`), rejecting `javascript:`, `data:`, `vbscript:`, and any other unknown scheme — including obfuscated variants hidden behind control characters, HTML entity encoding, percent-encoding, or case variation — without ever throwing, since a URL is document data, not a programmer-controlled literal. `capString(value, maxLength)` truncates a string defensively.

`richTextSchema` validates a constrained subset of Lexical's serialized JSON node format (ADR-017: `root`, `paragraph`, `heading`, `list`, `listitem`, `quote`, `link`, `text` with a format bitmask, `linebreak`). `normalizeRichText(value)` walks arbitrary, untrusted JSON into a tree that always conforms to that schema — an unrecognized node type is dropped with a diagnostic rather than passed through raw, a link's `url` goes through `sanitizeUrl` (falling back to `''` when unsafe), a `text` node's content is capped, and nesting beyond `MAX_RICH_TEXT_DEPTH` is truncated — never throwing, even for adversarial input. `plainTextToRichText(text)` wraps a plain string in a single paragraph, per the `string -> richText` coercion in `docs/dynamic-bindings.md`.
