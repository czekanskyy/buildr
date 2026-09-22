# Accessibility

## Accessibility in the component model

| Area | Mechanism |
|---|---|
| Semantic HTML | `a11y.element` in the metadata. The rendered element is driven by a semantic prop: Section's `as` (`section/header/footer/main/aside/nav/article/div`), Heading's `level`, Text's `as` (`p/span/small/strong/em`), List's `ordered`. Semantics is independent of appearance — heading size is a style, not `level`. |
| Roles | No arbitrary `role` prop. A component either has a fixed role, or an allowlisted set of overrides (Stack: `group`, `list`). |
| ARIA | Only semantic props under an "Accessibility" group: `ariaLabel`, `ariaDescription` (rendered as `aria-describedby` pointing at a visually-hidden element). An allowlist, never raw `aria-*` passthrough. |
| Keyboard | Interactive components implement WAI-ARIA APG patterns: Accordion uses native `<details>/<summary>`; Tabs (v0.2) uses roving tabindex with arrow keys; Modal (v0.3) uses native `<dialog>` and `showModal()` (the browser handles focus trapping and inertness). |
| Focus | A `--b-focus-ring` token. Every interactive component ships a `:focus-visible` style in its own CSS. The style model has no way to remove the outline. |
| Alt text | Image: `alt` (a `Value`, defaulting to the media asset's own `alt`) plus `decorative: boolean` (renders `alt=""`). Missing `alt` when `decorative` is false is a validator error. |
| Heading hierarchy | `level` is independent of appearance. The validator checks ordering; a collection-level `expectH1` setting decides whether the page layout or the document itself is expected to render the H1. |
| Forms | Input/Textarea/Select/Checkbox require a `label` (an optional `hideLabel` makes it visually hidden but still accessible), a `hint` wired through `aria-describedby`, and `required` sets both the `required` attribute and `aria-required`. Errors are associated with their field and announced in a live region. |
| Reduced motion | Component transitions are scoped under `@media (prefers-reduced-motion: no-preference)`. Video/carousel autoplay is disabled under reduced motion; autoplay otherwise requires `muted` plus visible controls. |
| New-tab links | Automatically append visually-hidden text ("(opens in a new tab)") and `rel="noopener noreferrer"`. |

## The accessibility validator (`core/a11y`)

```ts
export interface A11yRule {
  id: string; severity: 'error' | 'warning' | 'info';
  appliesTo?: ComponentType[] | '*';
  check(ctx: A11yContext): A11yIssue[];
}
export interface A11yContext {
  doc: BuilderDocument; index: DocumentIndex; registry: RegistryMeta;
  resolve(nodeId: NodeId, prop: string): unknown;       // against sample data, when available
  effectiveStyle(nodeId: NodeId, bp: BreakpointId): StyleDecl;
  config: A11yConfig;                                    // expectH1, publishPolicy, disabledRules
}
export interface A11yIssue { ruleId: string; severity: A11yRule['severity']; nodeId: NodeId; message: string; help?: string; fix?: Command }
export function runA11y(doc, registry, opts): A11yIssue[];
```

**MVP rules**: `image-alt`, `heading-order` (level skips, multiple H1s, missing H1 per `expectH1`), `empty-heading`, `button-name`, `link-name`, `link-href` (empty or `#`), `form-label`, `form-submit` (a form with no submit button), `nested-interactive`, `duplicate-anchor`, `list-structure` (a List containing only ListItems), `landmark-unique` (multiple `main`s, multiple unnamed `nav`s), `accordion-structure` (an item with no summary), `new-tab-link` (info-level), plus `missing-translation` (info-level, localization-related).

**v0.2 additions**: `color-contrast` (statically computed when both colors are known tokens/literals), `dialog-name`, `tabs-structure`, `max-depth` (excessive nesting), `autoplay-media`, `aria-valid`.

**Where it runs**: live in the editor (debounced 300ms, Issues panel, clicking an issue selects the node, an optional `fix` command auto-resolves it where the fix is unambiguous); in Payload's publish hook (`publishPolicy: 'warn' | 'block'`, default `warn`); in CI against seeds and fixtures. `@axe-core/playwright` complements this in end-to-end tests against the real rendered DOM — the static validator catches issues at edit time, before anything ships.

**Editor accessibility itself**: the layers panel is an ARIA tree navigable by keyboard, inspector controls are properly labeled, UI primitives come from Radix, and nodes can be reordered by keyboard (Alt+Up/Down). Target: WCAG 2.2 AA for the editor UI by v1.0.
