# ADR-017: Rich text format

**Status:** Accepted

## Context

Formatted content (paragraphs, headings, lists, inline marks, links) needs a canonical storage format that is safe to store as JSON, safe to render without an HTML sanitizer, and — ideally — directly interoperable with Payload's own rich text fields.

## Options

1. **Raw HTML** — requires a sanitizer on every render path and is a persistent XSS risk surface; rejected.
2. **Markdown** — lossy for some formatting, and still needs a parser/renderer with its own trust boundary.
3. **Portable Text (Sanity's format)** — well-designed, but adds an unrelated ecosystem dependency with no interoperability benefit here.
4. **ProseMirror JSON** — solid, but no natural interoperability with Payload, which uses Lexical.
5. **A constrained subset of Lexical's serialized JSON**, walked to React via an allowlisted, extensible converter registry.

## Decision**

Rich text is stored as a **validated subset of Lexical's JSON node format** (`root, paragraph, heading, list, listitem, quote, link, text (with format bitmask), linebreak` in MVP). Rendering is a JSON→React walker (`richTextConverters`, extensible — `@next-buildr/payload` adds converters for Payload-specific nodes like `upload`/`relationship`); unknown node types are dropped with a diagnostic, never passed through raw.

## Consequences

- Native interoperability with Payload's Lexical-based rich text fields — a `richText`-typed binding to `post.content` requires no format translation.
- No `dangerouslySetInnerHTML` anywhere in the rendering pipeline.
- The editor's rich text control (task PB-080) is a small, purpose-built Lexical instance serializing directly to this schema, not a full Lexical playground.
