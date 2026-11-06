# ADR-028: External media and embeds

**Status:** Accepted (2026-11-06)

## Context

Container backgrounds and embedded media need library-backed assets as well as external sources. External hosts can track visitors, disappear or serve content the author lacks rights to use.

## Options

1. **Library media only** — rejected: it excludes legitimate externally hosted media and embeds.
2. **Unrestricted URLs in styles or arbitrary embed HTML** — rejected: bypasses the style grammar and exposes visitors to unvalidated content.
3. **Validated media props and constrained components with explicit external-source confirmation** — preserves typed styles and makes the trade-offs visible to authors.

## Decision

Container background image, video and overlay are `media`-kind props; library references are resolved by the adapter and `prepareRender`, not fetched by components. Repeat, attachment, position and size are typed style-level properties. No free URL enters styles; ADR-006 remains intact for styles.

External URLs are allowed for image, video and background media. Adding an external URL opens a mandatory editor confirmation dialog with the Polish copy below; confirmation requires an explicit choice, and cancellation does not add the URL. The same dialog applies to iframe URLs. External URLs are validated by the renderer, not entrusted to the editor: HTTPS only, no credentials, a bounded length and an optional host-configured domain allowlist. Invalid URLs are not rendered and produce a diagnostic. Apply validation to stored and resolved values on every render; editor validation is only feedback.

Add `buildr/video`: library or external file, poster, controls, loop and autoplay subject to muted autoplay rules; require an accessible name and allow an optional captions track. Add `buildr/iframe`: HTTPS only, required accessible title, a restrictive default `sandbox`, `referrerpolicy` and `loading=lazy`; grant no `allow` features by default. Plugin options may restrict iframe domains via a host allowlist. Sandbox permissions must not be silently widened.

## Consequences

- External media can expose visitor IP addresses and tracking, fail or change without notice; confirmation and the recommended media library make this risk visible but cannot guarantee rights or availability. HTTPS avoids mixed-content media; validate redirects and host policy as applicable.
- Both components must meet the full [component Definition of Done](../ai/component-development.md), including metadata, accessibility, fixtures, tests, documentation and changeset. Schema changes follow ADR-014 migrations and fixtures.
- A restrictive iframe sandbox may prevent some providers from working; any future permission expansion needs explicit design and host control.

## Appendix: Polish confirmation copy

**Zewnętrzne źródło**

Ten link prowadzi do zewnętrznego źródła poza domeną witryny. Upewnij się, że masz prawa do korzystania z tego materiału. Zewnętrzne źródła mogą śledzić odwiedzających, przestać działać lub powodować problemy z mieszaną zawartością i licencją. Zalecamy korzystanie z biblioteki mediów.

**Anuluj** / **Potwierdzam i dodaję link**
