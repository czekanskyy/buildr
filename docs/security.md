# Security model

See also [ADR-016](adr/ADR-016-security-model.md).

| Threat | Mitigation |
|---|---|
| XSS via props / bindings / CMS data | React escapes text. `dangerouslySetInnerHTML` is forbidden (linted) outside an audited, isolated code path (a v0.3 sandboxed embed). Values sourced from bindings go through the same validation and sanitization as static values. |
| Malicious URLs | `sanitizeUrl`: allows `http:`, `https:`, `mailto:`, `tel:`, relative paths, `#anchor`. Blocks `javascript:`, `data:`, `vbscript:`, unknown schemes, and obfuscation (control characters, entities). Applies to `link`/`media` props and to rich text. |
| Rich text | A JSON walker with an allowlist of node types. No raw HTML. Links are sanitized. |
| CSS injection | A per-property value grammar (no `url()`, `;`, `}`, `@`, `\`), an allowlisted token name set, a validated theme. The compiler only ever emits already-validated values. |
| HTML embeds | Out of MVP. In v0.3: an `Embed` component with an **allowlisted provider set** (YouTube, Vimeo, Maps, Spotify, ...). The user supplies a URL; the `src` is built from the provider's own template, with `sandbox`, minimal `allow`, `referrerpolicy`, and `loading=lazy`. |
| Custom HTML / custom JS | **Not in MVP.** The v0.3 safer model: "Custom HTML" only inside a `srcdoc` iframe with `sandbox="allow-scripts"` (no `allow-same-origin`, so it runs with an opaque origin, no cookie/DOM access to the parent), auto-height via postMessage, gated behind an `unsafeEmbed` permission restricted to the admin role. Custom JS/React is instead added by a developer as a **registered component** (code-reviewed, typed) — never authorable from inside the editor. |
| Expression execution | No `eval`/`Function`, an allowlisted function set, no prototype or host-object access, step/size limits, no regex. |
| Untrusted JSON (database, clipboard, postMessage, API) | Zod validation of the envelope plus limits, invariants, and per-component prop validation at every boundary. Unknown fields are preserved but never rendered. Parsing enforces a size limit. |
| Authorization | Every endpoint requires a Payload user. Local API calls always use `overrideAccess: false`. `edit`/`publish`/`unlockTemplates` permissions are enforced server-side. |
| Tenant boundaries | Payload's own access control (including its multi-tenant plugin) applies to every operation, including `QuerySpec` execution against documents. Production-time queries run with the **viewer's** permissions (public read), never the author's. Collections and fields exposed to `QuerySpec` are explicitly allowlisted (`queryable`). |
| Data leakage via bindings | `DataSchema` acts as an allowlist. `users` is never a context scope (only `authors`). Hidden/sensitive fields are excluded. |
| Preview endpoints | Require an authenticated user. Redirects only target relative paths. Canvas and preview responses: `Cache-Control: private, no-store`, `noindex`. Draft mode is gated behind authentication. |
| postMessage | `targetOrigin` is always a concrete value, never `'*'`. Both sides verify `event.origin` (allowlisted), `event.source === iframe.contentWindow`, a session nonce, and message schema/version. Malformed messages are dropped. |
| Iframe / clickjacking | The canvas route sends `frame-ancestors` set to the editor's origin. The editor route sends `frame-ancestors 'none'`. The canvas route itself requires authentication. |
| CSRF | Payload's own `csrf` origin allowlist. Mutating requests require `Content-Type: application/json` and an `Origin` check. |
| Denial of service | Document limits, `limit <= 50` on queries, no nested Loop queries, expression evaluation budgets, form submission rate limiting. |
| Forms | The field schema is derived server-side from the **published** document (never trusted from the client), with type/length validation, a honeypot field, IP-hash rate limiting, and an allowlisted notification-recipient set. |
| Supply chain | pnpm lockfile, `onlyBuiltDependencies`, Renovate, npm publish with provenance (OIDC), 2FA/Trusted Publishing, CodeQL. |

See also [payload.md](payload.md#authentication-and-authorization) for the concrete access-control implementation, and [editor.md](editor.md#the-postmessage-protocol) for the protocol's own security details.
