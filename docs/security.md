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
| Supply chain | pnpm lockfile, `allowBuilds`, Renovate, npm publish with provenance (OIDC), 2FA/Trusted Publishing, CodeQL. |

## Provider embeds (Map)

`buildr/map` ([ADR-029](adr/ADR-029-provider-embeds-and-form-challenges.md)) embeds the Google Maps Embed API. It is off until the host sets `Platform.maps`. Hosts that turn it on must do the following.

- **CSP.** If your CSP restricts frames (`frame-src` or `default-src`), add `https://www.google.com` to it, and only when a key is configured; without a key the block renders a link and loads nothing. Do not add a new `frame-src` line to a CSP that has none: it would block every other frame, such as `buildr/iframe` hosts. If your CSP does not restrict frames, nothing is needed.
- **Key restriction.** The Maps Embed API key is public: it is in the page HTML and RSC data (the frame URL). Restrict it in Google Cloud to the Maps Embed API and by HTTP referrer. List every site origin as `https://<site-origin>/*`, and the editor preview origin if the preview should show the map. An unrestricted key can be copied and used by anyone. The frame sends `referrerpolicy="strict-origin"`, so Google sees the origin only, never the path.
- **Consent and GDPR.** Click-to-load is on by default. Until the visitor clicks, nothing reaches Google. After the click Google receives the visitor's IP address, user agent and the site origin, and any cookies Google already has in that browser, which may identify a signed-in Google user (the frame has `allow-same-origin`, and browsers that allow third-party cookies send them). Google may also store data in its frame. The fixed notice before the click mentions the IP address and stored data only, so the host's privacy policy must describe the rest. The notice before the click is the fixed catalog text; authors cannot change it. The host is the controller and must name Google in its privacy policy. Buildr remembers no consent. A host that sets `clickToLoad: false` is responsible for consent before the page renders. If that depends on a per-visitor decision, use a per-request `Platform` and dynamic, uncached rendering: a static or ISR page would cache the iframe and serve it to visitors who never consented.
- **`iframeHosts`.** The frame URL is checked against `capabilities.iframeHosts`. A host that sets the list must include `www.google.com`, or the map falls back to the link.
- **`buildr/iframe` is unchanged.** It keeps `sandbox="allow-scripts"` and `referrerpolicy="no-referrer"`. The Map sandbox (`allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`) applies only to the constant Google origin, which the author cannot change, so the frame is never the site's own origin. The configuration does trust Google with unsandboxed popups; only the initial `src` is validated.
- **Canvas.** The editor canvas never loads a provider and never receives the key.

Known limit: the exact sandbox together with `strict-origin` has not been checked against Google with a real, referrer-restricted key. Check it once before relying on it. If it fails, the fix is a new ADR, not an ad-hoc sandbox token.

See also [payload.md](payload.md#authentication-and-authorization) for the concrete access-control implementation, and [editor.md](editor.md#the-postmessage-protocol) for the protocol's own security details.
