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

## Using the validator (`runA11y`)

```ts
const issues = runA11y(doc, registry, {
  config: { expectH1: 'layout', disabledRules: [] },   // both optional
  locales,                                              // LocaleConfig; without it only one language exists
});
```

Issues come back in render order, then rule order. Never throws for bad data; a rule that throws is reported as an `a11y-internal` warning on the root so the other rules still run.

**Values bound to data are not judged.** The validator has no visitor's data, so a prop that is a binding or an expression is treated as unknown and rules skip it. That is what keeps false positives out; the axe run against real DOM covers the rest.

**Languages.** Rules marked `perLocale` (`image-alt`, `empty-heading`, `button-name`, `link-name`, `link-href`, `form-label`, `landmark-unique`, `accordion-structure`, `missing-translation`) run once per language in `locales.locales` and set `issue.locale`. A localizable prop with no translation counts as its default-language text when `fallback` is on, and as empty when it is off. `missing-translation` (info) lists text-bearing localizable props (`text`, `textarea`, `richText`) of the default language with no translation for a language; URLs, media and bindings are not reported. Mark semantic props (`as`, `type`) `localizable: false` so they are not listed.

**`expectH1`.** `'layout'` (default): the page layout renders the H1, so the document starts at level 2 and any H1 inside it is a warning (with a fix to level 2). `'document'`: the document must contain exactly one H1.

**Conventions the MVP rules read.** The rules are keyed on component types and prop names, and skip anything the component does not declare:

| Rule | Component / props |
|---|---|
| `image-alt` | `buildr/image`: `alt`, `decorative`. Only an alt that was *explicitly* set to empty is flagged; an unset alt falls back to the media asset's own |
| `heading-order`, `empty-heading` | `buildr/heading`: `level` (number), `text` |
| `button-name`, `link-name` | `buildr/button`, `buildr/link`: `label`, `ariaLabel` (children also count as a name) |
| `link-href`, `new-tab-link` | `buildr/link`: `href`, `newTab` |
| `form-label` | `buildr/input/textarea/select/checkbox`, or any component with `formField`: `label`, `ariaLabel` |
| `form-submit` | `buildr/form` with no descendant `buildr/button` whose `type` is not `button`/`reset` (no `type` prop means submit) |
| `nested-interactive` | any component with the `interactive` content category |
| `duplicate-anchor` | `node.anchor` |
| `list-structure` | `buildr/list` children must be `buildr/list-item` (or a `buildr/loop`) |
| `landmark-unique` | components with `a11y.landmark`; the element comes from an `as` prop or `a11y.element` |
| `accordion-structure` | `buildr/accordion-item`: `summary` |

A component can also opt into a custom rule by listing its id in `a11y.rules`; `ctx.nodesFor(rule)` returns those nodes together with the rule's `appliesTo` types. Sample-data resolution (`ctx.resolve` in the sketch above) is not implemented yet: dynamic values stay unknown.
