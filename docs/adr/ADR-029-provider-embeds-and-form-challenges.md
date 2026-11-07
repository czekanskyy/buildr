# ADR-029: Provider embeds and form challenges

**Status:** Accepted (2026-11-07)

## Context

ADR-028 fixes the `buildr/iframe` sandbox at `allow-scripts` with `referrerpolicy="no-referrer"`, and says sandbox permissions must not be silently widened. ADR-016 allows no custom JavaScript on public pages, and no ADR covers a server-side secret. Two blocks need more than that. A Google map (`buildr/map`, PB-160c) does not work in an opaque-origin sandbox, and its key restriction needs a referrer. A form challenge (`buildr/captcha`, PB-160d) needs a provider script on the page and a secret on the server. Both send the visitor's IP address to a third party (GDPR). The user decided on 2026-11-07 to use the Google Maps Embed API with a host key, Cloudflare Turnstile behind a provider-neutral interface, and click-to-load by default.

## Options

1. **Use `buildr/iframe` with an author URL.** No new code. But the map breaks under `allow-scripts` alone, and widening the sandbox for author URLs would also widen it for a URL on the site's own origin, which can then lift its own sandbox. Rejected.
2. **A host flag that widens `buildr/iframe` for listed hosts.** Generic. But the author still controls the path and query, and one flag would cover every provider. Rejected.
3. **Keyless `https://www.google.com/maps?q=…&output=embed`.** No key needed. But it is undocumented, outside the Maps terms, and can stop working without notice. Rejected (user decision 2).
4. **Dedicated provider blocks.** The renderer builds the URL from a fixed template, each block has its own fixed sandbox, the host opts in through `Platform`, and the provider loads after a click. Narrow and testable. It costs one block per provider and a new optional `Platform` field. **Chosen.**
5. **Captcha: only the honeypot and rate limiting (today).** No third party. But it does not stop targeted bots. Kept as the first layer, not as the answer.
6. **Captcha: reCAPTCHA, hCaptcha, or a self-hosted proof-of-work.** reCAPTCHA tracks more. Proof-of-work needs a new dependency or its own crypto. The neutral interface leaves room for these later. Not now.

## Decision

### Common to Map and Captcha

- **Opt-in through `Platform` (`@next-buildr/react`), not `HostCapabilities`.** Capabilities live in core and travel to the editor and canvas over `postMessage`. Keys and provider settings never enter the document, manifest, capabilities, editor or canvas protocol. Absent `Platform.maps` / `Platform.captcha` means off.
- **Click-to-load is on by default.** Only a literal `clickToLoad: false` turns it off. A host that turns it off takes responsibility that consent is given before the page renders. A consent-dependent `clickToLoad: false` needs a per-request `Platform` (a per-request config) and dynamic, uncached rendering: `@next-buildr/next` creates its config once, and a static or ISR page would cache the HTML with the provider iframe and serve it to visitors who never consented. Without that, keep click-to-load on. `docs/nextjs.md` says so. Consent is never remembered by Buildr: no cookie, no storage.
- **The canvas (`env.mode === 'canvas'`) never loads a provider.** It renders no provider iframe, no provider script, no preconnect, and no URL that carries a key. The canvas `Platform` omits `maps` and `captcha` (it is built on the client, so a key passed to it would ship in the editor bundle), and the view checks `env.mode` before it reads them. A test asserts that canvas output contains no `key=`. `preview` and `production` behave the same.
- **Only provider URLs that are fixed constants.** No author-supplied URL, sandbox or `allow` value exists for these blocks.
- **CSP the host must allow when it opts in.** Maps: `frame-src https://www.google.com`. Turnstile: `script-src https://challenges.cloudflare.com` and `frame-src https://challenges.cloudflare.com`, plus outbound HTTPS from the server to `challenges.cloudflare.com`. A host that sets `capabilities.iframeHosts` must also list `www.google.com`, or the map renders as a link only.
- **GDPR.** Loading a map sends the visitor's IP address, user agent and the site origin to Google, and Google may set storage in its frame. Loading the widget sends the IP address and browser signals to Cloudflare. The host is the controller and must name both in its privacy policy. The placeholder text (appendix) discloses this before the click.

### Map only (PB-160c)

- **`Platform.maps?: { readonly apiKey: string; readonly clickToLoad?: boolean }`.** This field is the host flag. It is absent, and so off, by default. The key is a public Maps Embed API key. The host restricts it in Google Cloud to the Maps Embed API, and by HTTP referrer to `https://<site-origin>/*`, plus the editor preview origin if the preview should show the map. A key that does not match `^[A-Za-z0-9_-]{20,128}$` counts as absent. The key appears in the rendered `src` (public by design). It is never stored anywhere else.
- **Props (v1).** `query` (text, bindable), `zoom` (number 0–21, default 15), `mapType` (`roadmap` | `satellite`, default `roadmap`), `title` (text, localizable, bindable), `aspectRatio` (the iframe ratios, default `16:9`).
- **Query normalisation.** Lone surrogates become U+FFFD (`String.prototype.toWellFormed`), because `encodeURIComponent` throws on them and bound or CMS data must not crash the render. Whitespace runs, including newlines, become one space. Other control characters are removed. The query is then trimmed. The length limit is 256 code points, measured in code points, not UTF-16 units. If the query is empty or longer, the site renders nothing and the canvas shows a diagnostic placeholder.
- **Clamping.** Zoom is rounded and clamped, and a non-finite value becomes 15. An unknown `mapType` becomes `roadmap`.
- **Frame URL (mode `place` only), exact:**
  `https://www.google.com/maps/embed/v1/place?key={K}&q={Q}&zoom={Z}&maptype={M}&language={L}`
  Each value is `encodeURIComponent(String(value))`. Do not use `URLSearchParams`, which writes `+` for a space. `&language={L}` is appended only when `env.locale` matches `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$`.
- **Link URL (keyless Maps URLs API), exact:** `https://www.google.com/maps/search/?api=1&query={Q}`.
- **Validation.** Both URLs pass `checkExternalUrl`. The frame URL is checked against `iframeHosts`. `checkExternalUrl` is documented as never throwing, but the shared sanitiser it calls decodes numeric HTML entities with `String.fromCodePoint` and throws a `RangeError` for a code point above U+10FFFF (a query such as `&#99999999;` reaches it after one percent-decoding pass). `buildr/map` therefore wraps every check in `try`/`catch` and treats a throw as an invalid URL; the sanitiser bug itself is a separate core fix, not part of PB-160c. A frame URL that fails gives a link-only render. The encoded URLs can be much longer than the query (256 CJK characters encode to about 2,300 characters), so the length cap of `checkExternalUrl` applies to the encoded URL. If the link URL fails too, the site renders nothing and the canvas shows a diagnostic.
- **Iframe attributes, exact:**
  - `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`
  - `referrerpolicy="strict-origin"`
  - `loading="lazy"`
  - `title` = `title`, or the message "Mapa: {query}"
  - no `allow` attribute and no `allowfullscreen`. That supplies no explicit delegation: the frame's effective permissions follow each feature's default and inherited Permissions Policy, not a blanket deny
- **Why each sandbox token is granted:**
  - `allow-same-origin` lets the Google document keep its own origin, `https://www.google.com`. Without it, the opaque origin breaks its requests and storage. This is safe here and only here: the origin is a constant the author cannot change, so the frame can never be the site's own origin and lift its sandbox.
  - `allow-popups` is needed for Google's "view larger map" and directions links.
  - `allow-popups-to-escape-sandbox` lets that new tab be an ordinary Google Maps page.
- **What this trusts Google with.** While Google's document stays cross-origin, the same-origin policy prevents access to the parent page's DOM. The configuration nevertheless trusts Google with unsandboxed popups to arbitrary destinations (`allow-popups-to-escape-sandbox`), without a guaranteed `noopener`, with browser-permitted custom-protocol handoffs (which `allow-popups` implicitly enables), and it does not itself pin later navigations of the frame: URL validation covers only the initial `src`.
- **Never granted:** `allow-forms`, `allow-top-navigation*`, `allow-modals`, `allow-downloads`, `allow-pointer-lock`, `allow-presentation`, `allow-orientation-lock`, `allow-storage-access-by-user-activation`.
- **Referrer policy.** `strict-origin` sends only the origin, which a referrer-restricted key needs. It never sends the page path, and sends nothing on a downgrade. `no-referrer` would make a restricted key fail. Google's sample, `no-referrer-when-downgrade`, leaks the full URL.
- **Relation to ADR-028.** This is a narrow, explicit widening, not a silent one. It holds only for the constant origin `https://www.google.com/maps/embed/v1/`, only when `Platform.maps` is set, and only in `buildr/map`. It lives in its own constant, `MAP_SANDBOX`. `buildr/iframe` keeps `IFRAME_SANDBOX = 'allow-scripts'` and `no-referrer`, and a test guards both.
- **Render matrix:**

  | Situation | Output |
  |---|---|
  | No valid key, or host not allowed | the link only |
  | Valid key, click-to-load on | placeholder (notice + button) and the link |
  | Valid key, `clickToLoad: false` | the iframe in the server HTML and the link |
  | Canvas | placeholder with the canvas note and the link; never the frame URL or the key |

  The link always opens in a new tab with `rel="noopener noreferrer"`, and its text includes the "opens in a new tab" message. The ADR-028 confirmation dialog does not apply, because no URL is stored.
- **Click-to-load mechanism.** The shared view passes the checked frame URL to a client enhancer (`map/enhancer.client.tsx`). The enhancer server-renders the notice and a `<button type="button" hidden>` linked to the notice by `aria-describedby`. It removes `hidden` after hydration, so the initial client state matches the server HTML. Activating the button (click, Enter or Space) replaces the placeholder with the iframe and moves focus to the iframe. Without JS, the visitor sees the notice and the link, and nothing third-party loads.

### Captcha only (PB-160d; this ADR fixes the contract, PB-160d implements it)

- **Client config.** `Platform.captcha?: { readonly provider: 'turnstile'; readonly siteKey: string; readonly clickToLoad?: boolean }`. `siteKey` is validated like `apiKey` (`^[A-Za-z0-9_-]{1,128}$`), and an invalid one counts as off. `buildr/captcha` requires a `buildr/form` ancestor, with at most one per form. A captcha belongs to its nearest form, and counts whatever its visibility or conditions.
- **Provider script.** The enhancer injects `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` at most once, after the click or at mount when click-to-load is off. It is never server-rendered and never loaded in the canvas. The injected script tag carries the page's CSP nonce when the host uses one (PB-160d specifies how the nonce reaches the enhancer; without it a nonce-based `script-src` blocks the script and the form fails closed).
- **Widget.** It renders with `response-field-name: 'buildr-captcha'`. It is reset after every submission. It is bound to its form: the widget sets `action` to `buildr_form` and `cData` to a deterministic digest of the canonical layout reference and the form node ID. Single use stops replay of a token, not substitution of an unused token obtained for form A on form B that shares the site key and hostname, so the verifier returns both verified values and the endpoint rejects a missing or mismatched `action` or `cData`. This is a third-party script in the page origin, a deliberate exception to ADR-016's "no custom JavaScript". It is limited to this fixed URL, host opt-in, and pages with a captcha. There is no SRI, because the provider updates the script.
- **Secret.** It lives only in host env and the payload plugin option `forms.captcha.secretKey`. It never appears in the document, manifest, platform, editor, client bundle, logs or error bodies.
- **Expected hostnames.** They come from `forms.captcha.hostnames`, which is required when `forms.captcha` is set: the plugin fails at init without it (a fallback to Payload's `serverURL` would break split deployments such as `cms.example.com` and `www.example.com`). Matching is exact and lowercase. They are never taken from the request.
- **Verifier interface (provider-neutral):**

  ```ts
  interface CaptchaVerifier {
    verify(input: { token: string; signal: AbortSignal }): Promise<
      | { ok: true; hostname: string; action: string; cdata: string }
      | { ok: false; reason: 'invalid' | 'expired-or-reused' | 'unavailable' }>;
  }
  ```

  The Turnstile verifier POSTs `secret` and `response` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`. It does not send `remoteip`: the client IP the endpoint sees comes from a header a client can spoof, and Cloudflare already enforces single-use tokens. It calls the fixed endpoint with `redirect: 'error'`, so every redirect fails closed as `unavailable` and the secret-bearing body is never forwarded elsewhere. It validates the response with Zod. Cloudflare's `missing-input-secret` and `invalid-input-secret` map to `unavailable` (503) and log a configuration error. `timeout-or-duplicate` maps to `expired-or-reused`. Logs carry only the reason and the Cloudflare codes, never the token or the raw response.
- **Endpoint contract:**
  1. The endpoint decides whether a captcha is required from the published form subtree, never from the request. It determines the captcha requirement and derives the submission schema from the same immutable published-layout snapshot (resolved templates included) and keeps that snapshot across `siteverify`, so the two cannot disagree.
  2. Order: rate limiter, body, honeypot, published form lookup, token shape, `siteverify`, strip `buildr-captcha`, `validateSubmission`. On the HTML (non-JSON) form path, 422 and 503 become the usual `backTo` redirect.
  3. A token that is missing, not a single string matching `^[A-Za-z0-9._-]{1,2048}$`, invalid, reused or expired is rejected (422). A malformed token never causes an outbound call.
  4. The hostname must be one of the expected hostnames, and `action` and `cdata` must equal the expected values for this form.
  5. Timeout is 5 s (`AbortSignal.timeout(5000)`). A timeout, network error, non-2xx answer or malformed answer fails closed (503).
  6. A form with a captcha but no secret configured fails closed (503).
  7. Each server instance caps in-flight verifications (for example 16). Above the cap the endpoint answers 503 without an outbound call. The rate limiter only sees a hash of the client address that the endpoint derives from request headers, which a client can spoof when the host is not behind a proxy that overwrites them. PB-160d therefore adds a plugin option naming the trusted client-IP source, and documents that a host behind a proxy must set it.
  8. The `buildr-captcha` field is removed before validation and never stored or forwarded.
  9. A form without a captcha behaves exactly as before.
  10. `payload/adapter` does not change.
- **Field name.** `buildr-captcha` is reserved. As with the honeypot name, the constant is duplicated in components and payload, with a test on each side.

## Consequences

- Visitors who never click send nothing to Google or Cloudflare. Visitors without JS get a working map link. A captcha form without JS fails closed, which is accepted.
- The Map widening is tied to one constant origin and a host opt-in. Every other iframe stays as ADR-028 decided. A future provider needs its own ADR section and its own exact sandbox string.
- `Platform` gains optional `maps` (PB-160c) and `captcha` (PB-160d) fields. PB-160c is a minor release of `@next-buildr/components`, `@next-buildr/react` and `@next-buildr/next`; PB-160d adds `@next-buildr/payload` (`forms.captcha`). There is no core change and no migration.
- The Turnstile script runs with first-party power in the site's origin. If it were compromised and a logged-in editor opened the page, it could make credentialed Payload requests whenever the admin shares the site origin. Hosts should isolate the admin on a separate origin with host-only session cookies and server-enforced CSRF and `Origin` checks. `SameSite=Strict` alone does not isolate it from the provider script, because it does not restrict same-origin requests and sibling subdomains can be same-site. Click-to-load protects visitors only until the click.
- Hosts must update CSP, Google Cloud key restrictions and their privacy policy. The docs (`security.md`, `nextjs.md`, `components.md`) list these steps.
- If Google's embed stops working under this exact sandbox, the fix is a new ADR, never an ad-hoc token.
- **Out of scope:** Maps modes other than `place` (search, view, directions, streetview); the Maps JavaScript or Static APIs; markers and styling; other map providers; author-set sandbox or `allow`; remembering consent; a consent-manager API; proxying providers through the server; captcha providers other than Turnstile; captcha on endpoints other than forms; sending `remoteip`.

## Appendix: Polish copy

- Map notice: **Mapa pochodzi z Google. Po jej wczytaniu Google otrzyma Twój adres IP i może zapisać dane w przeglądarce. Szczegóły znajdziesz w polityce prywatności witryny.**
- Map button: **Pokaż mapę** · Link: **Otwórz w Mapach Google** · Frame title fallback: **Mapa: {query}**
- Map, canvas: **Mapa wczytuje się tylko na opublikowanej stronie.** · Canvas, no key: **Brak klucza Map Google: na stronie pojawi się tylko link.**
- Captcha notice: **Formularz chroni Cloudflare Turnstile. Po wczytaniu weryfikacji Cloudflare otrzyma Twój adres IP i dane o przeglądarce.**
- Captcha button: **Wczytaj weryfikację** · Error: **Weryfikacja nie powiodła się. Spróbuj ponownie.** · Unavailable: **Weryfikacja jest chwilowo niedostępna. Spróbuj później.**
