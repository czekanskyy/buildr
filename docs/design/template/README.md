# Buildr editor – static design template

Phase 2 export of the approved editor design (design canvas "Buildr Editor – projekt UI" and the
"Buildr Editor" design system, tokens v2). Plain static files: no build step, no dependencies.
Open `index.html` by double-clicking it.

| Page | What it shows |
| --- | --- |
| `index.html` | Full editor: top bar, Bloki / Struktura, canvas, settings panel, dialogs, toasts |
| `style-panel.html` | Settings panel with every Styl section and a live card preview |
| `components.html` | Control library (every control × every state), left panel, canvas states, dialogs and toasts, motion |

## Files

| File | Role |
| --- | --- |
| `css/tokens.css` | Design tokens, 1:1 from the design system. Scope `.buildr-editor`, dark theme via `data-theme="dark"` |
| `css/metrics.css` | Fixed geometry of individual widgets (box model, 3×3 pad, curve, tiles). Not part of the shared scale |
| `css/base.css` | Box model, type, icons, focus ring, utilities |
| `css/components.css` | Buttons, tooltips, segmented controls, tabs, fields, every inspector control, menus, dialogs, toasts |
| `css/editor.css` | Shell, top bar, panels, stage, canvas overlays, status bar, sample site, preview, motion demos |
| `css/template.css` | Only the strip that links the demo pages |
| `js/runtime.js` | Small view layer: parses each template, renders `{{holes}}`, `<sc-for>` and `<sc-if>`, patches the DOM in place and wires `on*` attributes to native events |
| `js/<screen>.js` | One component per screen; `renderVals()` returns the values its template reads. All state is mocked and resets on reload |

Each screen's markup lives in its HTML page inside `<script type="text/x-template" data-component="…">`,
next to the `<div data-mount="…">` it renders into.

## Interactions demonstrated

Tabs, accordions (open state remembered in `localStorage`), sliders and number fields that update the
canvas live, label scrubbing, link/unlink, colour popover, search filter, hover and selection, device
switcher with per-device overrides, tooltips, menus, "Odtwórz podgląd", publish and shortcuts dialogs
(focus trap, Esc), toasts with "Cofnij", and keyboard on the canvas (Tab, Enter, Esc, Delete, Ctrl+D, ?).

## Notes for the production build

- The runtime is a demo harness, not something to ship. `packages/editor` re-implements these screens;
  each `renderVals()` maps directly to a component's render data.
- Fonts load from Google Fonts; offline, the system font stack is used.
- `prefers-reduced-motion` sets every duration token to 0 ms.
- The sample site (`.site-*`, `.pv-*`) is user content and intentionally uses its own colours.
