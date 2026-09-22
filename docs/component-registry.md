# Component registry

See also [ADR-003](adr/ADR-003-component-registry.md).

## Metadata vs. implementation

A component definition has two layers:

- **`ComponentMeta`** (in `@buildr/core`, fully JSON-serializable). The editor builds its palette, inspector and drag-and-drop rules from this, and Payload validates documents against it. It reaches the editor through a `RegistryManifest` — the editor never imports component code.
- **React implementation** (in `@buildr/react`): `render` + `runtime` + `migrations` — functions, not serializable.

```ts
export interface ComponentMeta {
  type: ComponentType;                       // "buildr/heading"
  version: number;                           // prop schema version (>= 1)
  label: string; description?: string; keywords?: string[];
  category: 'layout' | 'content' | 'media' | 'ui' | 'forms' | 'cms' | (string & {});
  icon?: string;
  props: Record<string, PropDef>;            // the p.* DSL (serializable)
  slots?: Record<SlotName, SlotDef>;         // absent = a leaf component
  contentCategories: ContentCategory[];      // 'flow'|'phrasing'|'heading'|'interactive'|'form-control'|'list-item'|'landmark'|'media'
  parents?: { allow?: Matcher[]; deny?: Matcher[]; requireAncestor?: Matcher[] };  // Matcher = a type, or "#category"
  capabilities?: { insertable?: boolean; draggable?: boolean; removable?: boolean; duplicable?: boolean; root?: boolean };
  styles: { groups: StyleGroupId[] };        // which style groups the inspector edits
  a11y?: A11yMeta;                           // { element, role?, landmark?, requiresName?, rules?: RuleId[] }
  editor?: { inlineProp?: string; placeholder?: string; revealOnSelect?: boolean; emptySlotText?: Record<SlotName, string> };
  formField?: { valueType: 'string'|'email'|'tel'|'url'|'number'|'boolean'|'enum';
                nameProp: string; requiredProp?: string; maxLengthProp?: string; optionsProp?: string };  // form derivation, see components.md
  defaults?: { slots?: Record<SlotName, TreeNode[]> };   // children inserted together with a new node
  runtime: 'shared' | 'client';              // shared = works in RSC and the client; client = a 'use client' module
}

export interface SlotDef {
  label?: string;
  allow?: Matcher[]; deny?: Matcher[];
  min?: number; max?: number;
  axis?: 'vertical' | 'horizontal' | 'auto'; // drag-and-drop hint (auto = read from computed style)
}
```

## Props DSL (`p.*`)

```ts
import { p } from '@buildr/core';

props: {
  text:     p.text({ label: 'Text', default: 'Heading', required: true, bindable: true, maxLength: 300 }),
  level:    p.select({ label: 'Level', options: [1, 2, 3, 4, 5, 6], default: 2 }),
  href:     p.link({ label: 'Link', bindable: true }),
  image:    p.media({ label: 'Image', accept: ['image'], bindable: true }),
  body:     p.richText({ label: 'Content', bindable: true }),
  count:    p.number({ min: 1, max: 12, step: 1, default: 3 }),
  open:     p.boolean({ default: false }),
  icon:     p.icon(),
  items:    p.list(p.object({ label: p.text(), value: p.text() }), { max: 50 }),
  source:   p.listSource({ accept: ['posts', 'products'] }),
  ariaLabel:p.text({ label: 'Accessible name', group: 'a11y' }),
}
```

Each `kind` defines: the resolved TypeScript value type (used to infer `ResolvedProps<P>`), serializable metadata (label, group, options, min/max), a Zod validator, which `DataType`s it accepts as a binding, sanitization of the resolved value (e.g. `link` maps through `sanitizeUrl`), whether it is `localizable` by default (see [i18n.md](i18n.md)), and which inspector control renders it. MVP kinds: `text, textarea, richText, number, boolean, select, link, media, icon, list, object, listSource`. Custom kinds are a v0.2 editor plugin API extension.

## Content model and nesting rules

`canInsert(doc, index, registry, target, typeOrFragment)` returns a `Result<true, Reason>` and is the single source of truth used by drag-and-drop, paste, insert, commands and document validation. It checks the target slot's `allow`/`deny` and the moved node's `parents.allow`/`deny`/`requireAncestor` (matched by exact type or by `#category`); global HTML content-model rules (`#interactive` cannot contain `#interactive`, `#heading` only accepts `#phrasing`, a form cannot nest a form, `#form-control` requires a form ancestor); `slot.max` and cycle prevention; and locks (the nearest ancestor with `lock.structure` blocks structural changes unless the target sits inside a `region`). A `Reason` carries a code and a human-readable message, for example "Heading cannot contain Button (heading only accepts phrasing content)".

## Registering components

```ts
export const Heading = defineComponent({
  type: 'buildr/heading', version: 1, label: 'Heading', category: 'content', icon: 'heading',
  runtime: 'shared',
  props: { text: p.text({ default: 'Heading', bindable: true }), level: p.select({ options: [1,2,3,4,5,6], default: 2 }) },
  contentCategories: ['flow', 'heading'],
  styles: { groups: ['typography', 'spacing', 'size', 'background', 'border', 'effects'] },
  a11y: { element: 'h1-h6', rules: ['heading-order', 'empty-heading'] },
  editor: { inlineProp: 'text', placeholder: 'Heading' },
  render: HeadingView,
  migrations: {},
});

// Application: buildr.config.ts
export const registry = createRegistry({
  components: [...defaultComponents, PricingTable],  // runtime: 'client', rendered from a *.client.tsx file
  templates: [...defaultTemplates, AcmeHero],
});
```

`createRegistry` returns an immutable registry; `registry.extend({...})` produces a new one. There is no global, mutation-based `registerComponent()` call — that pattern breaks under RSC (multiple concurrent requests, multiple module instances) and under test isolation. Registering a custom client component means calling `defineComponent({ ..., runtime: 'client', render: MyClientComponent })` and adding it to the list passed to `createRegistry` in the consuming application. `@buildr/core` is never touched.

`createRegistry` validates at construction time: unique component types, valid names, `default` values that pass their own validator, slot consistency, and `runtime` consistency with the file naming convention (dev only).

Manifest: `toManifest(registry)` returns `{ protocol, hash, components, templates }` with no functions attached. The canvas reports its own manifest hash at handshake time; a mismatch with the editor's manifest triggers a warning and a reload.

Component look-and-feel (the design system) lives in the component's own CSS, built on design tokens and driven by variant props. A node's `styles` field carries only instance overrides — see [styles.md](styles.md).

## Composite components (templates)

```ts
export const Hero = defineTemplate({
  id: 'buildr/hero', version: 1, label: 'Hero', category: 'sections', thumbnail: 'hero.svg',
  lock: 'none',
  variants: { imageRight: heroImageRight, centered: heroCentered },
  tree: {
    type: 'buildr/section', name: 'Hero', props: { as: s('section'), container: s('lg') },
    children: [{ type: 'buildr/grid',
      children: [
        { type: 'buildr/stack', children: [
          { type: 'buildr/heading', props: { text: s('Build pages faster'), level: s(1) } },
          { type: 'buildr/text', props: { text: s('Short supporting copy.') } },
          { type: 'buildr/stack', name: 'Actions', region: 'actions', props: { role: s('group') },
            children: [{ type: 'buildr/button', props: { label: s('Get started'), href: s('#') } }] },
        ]},
        { type: 'buildr/image', props: { image: s(null), alt: s('') } },
      ]}],
  },
});
```

See [templates.md](templates.md) for the full model. `instantiateTemplate` assigns fresh IDs, sets `source` and `lock` on the root, and is validated by `canInsert`. Once inserted, a template instance is an ordinary, fully editable subtree — see [ADR-020](adr/ADR-020-composites.md).
