# Phase 16 — Editor redesign v2

The approved [template](../design/template/README.md) guides the editor presentation. Phase 13 is the prerequisite. The document model, commands and canvas protocol remain unchanged.

## Tasks

| ID | Work | Dependencies | Status |
|---|---|---|---|
| PB-151 | Tokens and theme foundation | PB-131, PB-147 | Done |
| PB-152 | Shell and toolbar | PB-151 | Done |
| PB-153 | Left panel | PB-151 | Done |
| PB-154 | Inspector | PB-151 | Done |
| PB-155 | Overlays and feedback | PB-151 | Done |
| PB-156 | Documentation, tests and baseline | PB-152–PB-155 | Done |
| PB-157 | Editor redesign fidelity: every screen, state and control, plus UI-only deferred features | PB-152–PB-156 | Done (reopened 2026-11-05; implemented 2026-11-06; merged in PR #152) |
| PB-159 | Visual fixes, round 1: Blocks tab (no "Recently used", always-open sections, 2/1 column grid, regrouped palette), square canvas with smaller margins | PB-157 | Done (merged in PR #153) |
| PB-160 | New palette blocks: Spacer, Anchor, Carousel, Gallery, Google Maps, Captcha | PB-159 | In progress (PB-160a done on `pb-160a/spacer-anchor-fieldset`, visual baselines pending; PB-160b done on `pb-160b/carousel-gallery` 2026-11-07, visual baselines pending; PB-160c and PB-160d not started) |

## Template mapping

| Template area | Production module |
|---|---|
| index: shell, toolbar, device and theme controls, status | `packages/editor/src/app`, `toolbar`, `styles/shell.css` |
| index: blocks, structure, breadcrumbs | `packages/editor/src/panels/insert`, `layers`, `breadcrumbs` |
| index: canvas and states | `packages/editor/src/canvas-host` |
| index: inspector | `packages/editor/src/panels/inspector` |
| index: dialogs, issues and toasts | `packages/editor/src/dialogs`, `panels/issues`, `ui/toast.tsx` |
| style-panel: layout, position, size, spacing, typography, colour, background, border and shadow | `packages/editor/src/panels/inspector/styles` |
| style-panel: live card | Canvas runtime and document renderer in `packages/react/src` |
| components: buttons, fields, tabs, menus, popovers and rich text | `packages/editor/src/ui`, `panels/inspector/controls` |
| components: left panel | `packages/editor/src/panels/insert`, `layers` |
| components: canvas states | `packages/editor/src/canvas-host`; canvas overlays in `packages/react/src/canvas` |
| components: dialogs and toasts | `packages/editor/src/dialogs`, `ui/toast.tsx` |
| components: motion and tokens | `packages/editor/src/styles` |

## Skipped / deferred template features

These template features are not implemented in production; some need additional behavior, a model or protocol signal, or work outside the editor package:

- Typography group for card, grid, form, loop and accordion; `page` effects group and `background` group for image, divider and icon.
- Heading Rich mode (needs a components schema change). Rich mode does not seed `rich` from `text`.
- Key forwarding from the canvas iframe: Tab/Shift+Tab/Enter, Mod+1/2/3 and Mod+. while the canvas has focus. Canvas Tab block traversal and Enter selection are therefore not available.
- `DocumentAdapter.historyUrl(ref)` adapter contract, publish address, schedule and `canUnlockTemplates` in `EditorSession` (WP9, payload adapter boundary). The Payload example app cannot unlock layers and does not pass `authorCode` to the editor.
- Background repeat, attachment and overlay controls in the style panel (container background image and video are available); independent border-side colours and styles; descendant link and button colour controls.
- Connection-lost canvas state requires a protocol signal. Existing selection and hover overlays remain in `packages/react` and are covered by the baseline; they are not deferred features.
- “Moje wzorce” saved-selection patterns: the insert palette only lists manifest components and templates; it has no save-selection action or personal pattern library.
- The template's full shortcut list is not reproduced by the help dialog. Production lists undo/redo (Mod+Z, Mod+Shift+Z / Mod+Y), copy/cut/paste (Mod+C/X/V), duplicate (Mod+D), delete (Delete/Backspace), move (Alt+Up/Down), select all (Mod+A), clear selection (Escape), save (Mod+S), help (?), Mod+1/2/3 and Mod+. `/` focuses palette search separately. Escape selects the parent and clears the selection at the top. Mod+J is only a host-override test example, not a default binding.
- Editor-controlled dark overlay colours inside the canvas; entrance animation preview cannot be replayed; custom CSS errors carry no line numbers.
- Hardcoded `buildr/*` ids in the Insert panel quick picks, templates and layers wrapper default (should come from manifest metadata).
- Duplicated external-URL entry (media control and picker URL tab); media dialog drop zone shown only when the adapter supports upload.
- Preview iframe sandbox uses allow-scripts with allow-same-origin on same-origin previews (hosts should use a separate preview origin). Iframe sandbox is fixed at allow-scripts without allow-same-origin, so some providers may not embed.
- Manifest size budget raised from 60 KB to 72 KB.

## PB-157 Template v2 fidelity

PB-151–PB-156 ported tokens and skins; PB-157 rebuilds the structure of every screen to match the template. UI only: no change to the document, commands, schema, canvas protocol, adapters or dependencies.

Acceptance criteria:
- The screens listed below match the template in light and dark at 1440, 1280 and 1024px, in PL and EN. The only allowed differences are the items still listed as deferred.
- Toolbar (three zones, page chip, page-options dialog, locale chip, icon Preview, more menu), left panel (Blocks / Patterns / Structure tabs, collapse and rail, target chip, Recently used, flat highlighted search results), status bar with labelled breadcrumbs, issues button and zoom menu, issues drawer inside the stage, inspector header, tabs, sections and widgets, dialogs, toasts and animations follow `docs/design/template`.
- Delete-section confirmation appears for a node with descendants; a node without descendants is removed at once with an Undo toast. Mod+1/2/3 and Mod+. work while focus is in the editor UI. Escape selects the parent and clears the selection at the top. The shortcuts dialog lists every shortcut that exists. The page-options dialog and the Patterns tab shells exist.
- No change to `packages/core`, the protocol, adapters or dependencies. Every string comes from the message catalogs. Typecheck, lint, boundaries, unit tests and both e2e suites pass; new axe states pass. The visual baseline is refreshed in the pinned Docker image and every new or changed PNG is reviewed.
- This section and the deferred list are updated; changesets are added for `@next-buildr/editor` (and `@next-buildr/react` if the canvas overlay chip changes).

Out of scope (stay deferred, need a protocol or API change): key forwarding from the canvas iframe (canvas Tab/Shift+Tab/Enter, Mod+1/2/3 and Mod+. while the canvas has focus); `DocumentAdapter.historyUrl` contract (the history button is available through the `historyUrl` prop only); editor-controlled dark overlay colours inside the canvas; the connection-lost canvas state.

Acceptance screens: nothing selected; button selected with Style tab (Spacing, Colours open); heading Content tab with rich text; Advanced tab; Structure; Blocks with target chip and Recently used; search results; Patterns; both panels collapsed to rails; more menu; locale menu; page options; publish; shortcuts; delete confirm; Undo toast; issues drawer; tablet and mobile frames; 1024px overlay mode; empty page; canvas hover and selection chip; every section of `style-panel.html`.

### PB-157 status and known limitations

Editor redesign fidelity: **Done** (reopened 2026-11-05; implemented 2026-11-06; merged to `main` in PR #152). The earlier "Done" was not true: a browser audit found the floating block toolbar, Advanced groups, animations, background types, layer visibility and lock, outlines, history, Help, a 768px tablet frame and narrow-width layout missing or wrong. The scope is full fidelity to `docs/design/template` wherever the architecture rules allow.

Done in this reopening:

- Canvas protocol v2: overlay chips with Polish labels, floating block toolbar, insertion plus point, block outlines, and a heartbeat ping/pong fix. Key forwarding is not done (see below).
- Responsive shell: toolbar More menu, panel sheets at 1024px and below, 768px tablet frame, 320px minimum width.
- Layer eye and lock, with structure-lock enforcement and `canUnlock`.
- Style tab fidelity: Typography, Colours (swatch, HEX and opacity), shadow presets, effects.
- Animacje (motion group, ADR-027).
- Zaawansowane: custom CSS, classes and attributes, behind host capability `authorCode` (ADR-026).
- Text modes Basic, Rich and HTML, with sanitised HTML.
- Container background image and video from the media library or an external https link, with the warning dialog (ADR-028).
- New Wideo and Iframe components.
- Struktura filter and expand/collapse all; media picker tabs.
- Optional version-history button through the `historyUrl` prop.
- Polish UI (en/pl catalogs); Docker visual baselines refreshed (editor shots in English, toast in Polish).
- Tests: unit 5,141; playground e2e 63; example app e2e 43.

Known limitations / not done:

- The overlay chip tag shows the raw component type id (the payload has no HTML tag).
- The device label keeps "Desktop · 1280px".
- Shadow geometry is limited to presets; custom shadow geometry is deferred.
- The Help menu item is shown only with `helpUrl`.
- Pattern category filters are skipped (categories are free-form); the grid / list palette toggle is removed (the template has none).
- The bind button keeps the Fixed / Data / Formula segmented control; there is no field help "?" (`PropDef` has no help text).
- Per-field keyword search, number stepper arrows and the hue slider are not done.
- The multi-node delete toast reads "Block “First +2” deleted" (no plural key).
- The page-options dialog is not in the template.
- Key forwarding from the canvas iframe and `DocumentAdapter.historyUrl` need protocol or API changes; proposed follow-up PB-158.

Release notes to flag:

- `changeset status` lists a major bump for all packages, although every PB-157 changeset is minor or patch. Likely cause: the config `fixed` group, probably the peer-dependency rule. Check before release.
- Canvas protocol v2 is wire-breaking: editor and react must be updated together, but it is filed as minor.
- Heading version 2 is an identity migration.

## PB-156 verification

Verified on 2026-11-03. Typecheck passes all 17 tasks; lint has zero errors; boundaries pass across 998 modules; all 405 editor tests pass. `pnpm e2e --concurrency=1 -- --workers=1` passes all 86 tests (43 playground, 43 example app), including English/Polish toast axe checks, Undo and dismiss actions, keyboard focus, two visible issue rows, inspector layout, and toolbar geometry at 1024/1280/1440px in both themes.

The visual baseline was refreshed cleanly in `mcr.microsoft.com/playwright:v1.63.0-noble`, with Node 22.23.2 and pnpm 12.11.2. `e2e:visual:update --workers=1 --reporter=line` and the subsequent `e2e:visual --workers=1 --reporter=line` each pass all 71 tests. The nine gallery baselines are unchanged.

- Refreshed 56 editor PNGs: `empty`, `hero-content`, `hero-style`, `hero-advanced`, `canvas-hover`, `canvas-selected`, `canvas-empty-slot`, `layers`, `insert-templates`, `publish`, `media-picker`, `issues`, `tablet`, and `mobile`, each in light/dark at 1280/1440px.
- Added `editor-toast-light-1280.png`, `editor-toast-light-1440.png`, `editor-toast-dark-1280.png`, `editor-toast-dark-1440.png`, `editor-toolbar-light-1024.png`, and `editor-toolbar-dark-1024.png`.
- Opened and checked at least ten generated PNGs against the template: toast, issues, Style inspector and publish dialog at 1280px in both themes, plus both 1024px toolbar states. Toast dismiss icons remain visible on inverted surfaces; the drawers show two complete rows; controls and dialog actions fit their regions.

PB-152 toolbar follow-up: at the final measured collapse level, the document title chip is hidden completely instead of shrinking to an unreadable sliver. Brand, panel toggles and actions remain visible; wider layouts retain the editable title and ellipsis. Geometry coverage checks both themes at 1024/1280/1440px.

Follow-up verification: typecheck (17 tasks), lint (zero errors), boundaries (998 modules), editor tests (405) and playground E2E (43) pass. Only the two 1024px toolbar PNGs were rewritten in the pinned Docker image with Node 22.23.2 / pnpm 12.11.2; both were opened and reviewed. The subsequent full visual run without updates passes all 71 tests. The initial update command rewrote no files because the difference was below the configured tolerance; the targeted forced refresh wrote each affected baseline once.

## PB-160 New palette blocks

Size L (ships as PB-160a–d). Status: **Proposed (card only); the five open questions were answered on 2026-11-07, see Decisions**. Depends on PB-157 (ADR-028, `media/external.ts`, Video, Iframe, the Form enhancer) and PB-159 (the regrouped palette Układ / Treść / Multimedia / Formularze, which skips types the registry lacks; adding a type there is a one-line change).

Missing blocks: Spacer, Anchor, Carousel, Gallery, Google Maps, Captcha. `packages/components/src/gallery.ts` is the fixture gallery, not an image gallery. `src/field/` already renders every field's label as a real `<label for>`, so a separate Etykieta block waits for a decision (question 4). The form "Przycisk" reuses `buildr/button`. Every new type starts at `version: 1`; no existing prop shape changes, so no migration. No change to `packages/core`.

### Design

- **Spacer** `buildr/spacer`: category `layout`, leaf. `size` (xs…2xl, default `md`, theme space tokens), `axis` vertical/horizontal. Renders `<div aria-hidden="true">`; style groups `size` and `visibility`. Canvas shows a hatched band with a minimum hit area.
- **Anchor** `buildr/anchor`: category `layout`, leaf. `name` matching `^[a-z][a-z0-9-]{0,63}$`, not bindable or localizable (`bc-` prefix reserved). Renders an empty `<span id>` with `scroll-margin-top`. Invalid name renders nothing on the site and a `#name` pill in the canvas. Duplicate ids: first wins (documented); a validation rule and a Link-control picker are follow-ups.
- **Carousel** `buildr/carousel` + `buildr/carousel-slide` (as accordion and accordion-item): category `media`. Props `ariaLabel`, `showArrows`, `showDots`, `loop`, `autoplay`, `interval`, `slidesPerView`. SSR view is a scroll-snap track (works without JS); a `*.client.tsx` enhancer, as `form/enhancer.client.tsx`, adds prev/next, dots, arrow keys, `inert` on off-screen slides, autoplay with a visible pause button (off in the canvas and under reduced motion). WAI-ARIA APG carousel markup.
- **Gallery** `buildr/gallery` + `buildr/gallery-item`: category `media`. Items are child nodes (core resolves only top-level `media` props), so a Loop can bind a CMS gallery. Props `ariaLabel`, `columns` 2–6, `aspectRatio`, `lightbox`; item `image`, `alt`, `caption`. Item is a `<figure>` with a link to the full image (opens without JS); the enhancer opens a native `<dialog>` lightbox (focus in and back, Esc, arrows, counter). No new dependency.
- **Google Maps** `buildr/map`: category `media`, leaf. Props `query`, `zoom`, `mapType`, `title`, `aspectRatio`. The author never supplies a URL: the renderer builds the Maps Embed API `place` URL with the host-supplied public key from `Platform.maps.apiKey` (see ADR-029 for the exact URL, sandbox and referrer policy); without a key only the "Otwórz w Mapach Google" link renders; click-to-load by default. Always renders an "Otwórz w Mapach Google" link. Needs a wider sandbox for this one provider (`allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`) behind a host flag that is off by default. The canvas never loads Google.
- **Captcha** `buildr/captcha`: category `forms`, leaf, `requireAncestor: buildr/form`, at most one per form. Proposed provider Cloudflare Turnstile behind a provider-neutral interface, no npm dependency. Public key via a new optional `Platform.captcha {provider, siteKey}`; the secret lives only in host env and the payload plugin option `forms.captcha.secretKey`, never in the document, manifest, platform or editor. The payload forms endpoint decides whether a captcha is required from the published form subtree (never from the request), verifies the token through an injected verifier (5 s timeout, hostname check), strips it before `validateSubmission`, and fails closed. `payload/adapter` does not change.
- **ADR-029 "Provider embeds and form challenges"** (Proposed): required for Maps and Captcha, because ADR-028 fixes the iframe sandbox at `allow-scripts` and no ADR covers third-party scripts on public pages or a server-side secret. Also refresh the index in `docs/ai/architecture-decisions.md`, which stops at ADR-025.

### Split (one PR each, in this order)

| Part | Work | Size / risk | Notes |
|---|---|---|---|
| PB-160a | Spacer + Anchor + Fieldset | M / normal | Implemented 2026-11-07 (Sol writer, `reviewer` cross-check in two rounds); Docker visual baselines pending |
| PB-160b | Carousel + Gallery | L / normal | Done on `pb-160b/carousel-gallery` 2026-11-07: reviewed blocks integrated into the library, editor and MCP fixture; Docker visual baselines pending |
| PB-160c | ADR-029, then Map | M / critical | ADR via planner, `security-reviewer` and Astra; accepted by the user before any code |
| PB-160d | Captcha | L / critical | Single writer (published API across react, next and payload); depends on 160c and the provider decision |

### Files

`packages/components/src/{spacer,anchor,carousel,carousel-slide,gallery,gallery-item,map,captcha}/`, `registry.ts`, `index.ts`, `gallery.ts` (fixtures), `messages/`; `packages/editor/src/{messages/pl/componentLabels.ts,ui/icon.tsx}` (after PB-159); 160c: `packages/react/src/define/types.ts`, `packages/react/src/index.ts`, `packages/next/src/platform.tsx` (the optional `Platform.maps` field); 160d only: `packages/react/src/define/types.ts`, `packages/next/src/platform.tsx`, `packages/payload/src/plugin/{endpoints/forms.ts,forms/captcha.ts,options}`; `apps/playground`, `apps/example-next-payload`; docs (`components.md`, `security.md`, `payload.md`, `nextjs.md`, ADR-029).

### Tests and acceptance

- Full component Definition of Done per type: SSR snapshot, root spread, prop validation, bindings, vitest-axe, `scaffold.test.tsx` and `conventions.test-kit.ts`, fixtures at 3 breakpoints, Docker visual baselines. Keyboard tests for carousel and lightbox (focus return). Map: exact `src` per input, encoding, sandbox string, link fallback, no key or disallowed host renders only the link. Captcha: no script in canvas or SSR; payload cases for valid, invalid, missing, reused token, timeout, no config, hostname mismatch, a form without captcha unchanged, token never stored.
- Without JS: the carousel scrolls, gallery links open images, the map shows its link, a captcha form fails closed. Nothing third-party loads in the canvas or without host opt-in. No core change, no migration.
- Changesets: components minor, editor patch; 160c: components minor, editor patch, react minor, next minor; for 160d react, next and payload minor. Test, typecheck, lint, `check:boundaries`, e2e and visual pass.

### Risks

Manifest may exceed 72 KB with 8 more types (measure and trim descriptions first). A Loop inside the gallery breaks `ul > li` (use `role="list"` / `role="listitem"`). Enhancers must not cause hydration mismatches. Host CSP must allow Maps and Turnstile (`script-src`, `frame-src`; document it). Maps and Turnstile send the visitor IP to Google and Cloudflare (GDPR). A captcha requirement read from the request could be bypassed. `src/gallery.ts` next to `src/gallery/` invites wrong imports.

### Decisions (user, 2026-11-07)

1. **Captcha: Cloudflare Turnstile** behind the provider-neutral interface. A form with a captcha is rejected when the server has no secret configured (fail closed).
2. **Maps: the official Maps Embed API with a host-supplied key** (`Platform.maps.apiKey`, public key restricted by HTTP referrer). Without a key the block renders only the "Otwórz w Mapach Google" link. The wider sandbox for this one provider is accepted in principle; ADR-029 states the exact sandbox string and the user still accepts the ADR before any code (PB-160c). This replaces the keyless `/maps?q=…&output=embed` template in the Design section.
3. **Consent: Maps and Captcha load only after a click by default** (placeholder with a button). A host that runs its own consent banner may turn the click-to-load step off by an option.
4. **Etykieta becomes a Fieldset block** (`buildr/fieldset`, `<fieldset><legend>`, category `forms`, `requireAncestor: buildr/form`) and replaces "Etykieta" in the Formularze section. The palette entry for the old label slot is removed from `BLOCK_SECTIONS` when the type lands. Add it to PB-160a or a separate small package (S, normal).
5. **Carousel: autoplay is in v1**, always with a visible pause/play button, paused on hover and focus, off under `prefers-reduced-motion`, and off in the canvas. Default `autoplay: false`; `interval` has a floor of 3000 ms.

