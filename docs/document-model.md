# Document model

The canonical, source-of-truth representation of a page. See also [ADR-002](adr/ADR-002-canonical-ast.md).

## Types

```ts
export type NodeId = string;            // /^[A-Za-z0-9]{10}$/ or the literal "root"
export type ComponentType = string;     // /^[a-z0-9-]+\/[a-z0-9-]+$/  e.g. "buildr/heading", "acme/pricing-table"
export type SlotName = string;          // /^[a-z][a-zA-Z0-9]*$/  "default" = children

export interface BuilderDocument {
  schemaVersion: 1;                              // document format version (core migrations)
  root: 'root';
  nodes: Record<NodeId, PageNode>;               // normalized tree
  components: Record<ComponentType, number>;     // prop-schema versions the document was written with
  meta?: { createdWith?: string; updatedWith?: string };  // e.g. "@next-buildr/core@0.1.0" (diagnostics)
}

export interface PageNode {
  id: NodeId;
  type: ComponentType;
  props?: Record<string, Value>;                 // only props declared in the component's schema; a missing key means "use the default"
  slots?: Record<SlotName, NodeId[]>;            // order = render order
  styles?: NodeStyles;                           // instance overrides only (see styles.md)
  name?: string;                                 // layers-panel label
  anchor?: string;                                // HTML id attribute, unique in the document, /^[a-z][a-z0-9-]{0,63}$/
  visibleIf?: BindingValue<boolean> | ExpressionValue<boolean>;
  lock?: { structure?: true; content?: true; style?: true };
  region?: string;                                // editable region inside a structurally locked subtree
  source?: { template: string; version: number }; // provenance from a template (composite)
  ext?: Record<string, JsonValue>;                // plugin extensions, namespaced keys "acme:foo"
}
```

## Key decisions

| Question | Decision | Why |
|---|---|---|
| Normalized vs. nested | **Normalized** (`nodes` map + ID lists in slots) | O(1) lookup, trivial moves, stable patch paths (`/nodes/<id>/props/text`), selective re-renders, near-1:1 mapping onto a future CRDT (`Y.Map`). Nested form exists only as the authoring format (templates/fixtures). |
| `parent` field | **Not stored** | Single source of truth for structure lives in slot lists. `DocumentIndex` (parent, slot, index, depth) is derived in O(n), memoized on `nodes` identity — ~2ms for 5000 nodes. |
| `children` vs. `slots` | **Only `slots`**, `default` = children | One mechanism for every tree algorithm; multi-region components (Card, Loop) need no separate model. |
| IDs | Random, base62, 10 chars; `root` fixed | No coordination needed for paste/merge/future multiplayer; safe as a CSS class fragment (`.b-<id>`); immutable for the node's lifetime; duplication/paste always mints new IDs. |
| Default prop values | Omitted from storage | Small documents. Changing a `default` is a **breaking change** requiring a migration that writes the old default explicitly. |
| Local component runtime state | **Never in the AST** | Only initial settings (`defaultOpen`, `defaultTab`) are stored as props. Editor UI state (collapsed tree rows, selection) lives in the editor's own state, never here. |
| Unknown component type | Preserved unchanged | Production renders `null` + a diagnostic; the editor shows an "Unknown component" placeholder. Never auto-deleted. |
| Component version newer than the running registry knows | Document is read-only in the editor | Protects against an older editor build corrupting a document written by a newer one. |
| Unknown props | Preserved + warning | Forward compatibility. The renderer only ever passes a component the props it declares in its schema. |
| Localization | Shared structure, translations in values (`StaticValue.l10n`) | See [`i18n.md`](i18n.md) and [ADR-023](adr/ADR-023-localization.md). |

**Limits** (validated at every trust boundary): `maxNodes 5000`, `maxDepth 48`, `maxSlotChildren 500`, `maxStringLength 50 000`, `maxRichTextBytes 200 000`, `maxDocumentBytes 2 MB`. Configurable downward.

**Invariants** (`assertDocumentInvariants`, run in dev/tests after every command): `nodes.root` exists and is of the root type (`buildr/page`); every map key equals its node's `id`; every non-root node appears in exactly one slot of exactly one parent; no cycles, no orphans; slot names referenced exist on the component (when the type is known); `anchor` values are unique.

## Example

```json
{
  "schemaVersion": 1,
  "root": "root",
  "components": { "buildr/page": 1, "buildr/section": 1, "buildr/heading": 1, "buildr/text": 1, "buildr/button": 1 },
  "nodes": {
    "root": { "id": "root", "type": "buildr/page", "slots": { "default": ["S7fK2a9Qxp"] } },
    "S7fK2a9Qxp": {
      "id": "S7fK2a9Qxp", "type": "buildr/section", "name": "Hero",
      "props": { "as": { "kind": "static", "value": "section" }, "container": { "kind": "static", "value": "lg" } },
      "slots": { "default": ["H1a2b3c4d5", "T9z8y7x6w5", "B0q1w2e3r4"] },
      "styles": {
        "base": { "spacing": { "padding": { "top": "$space.24", "bottom": "$space.24" } } },
        "bp": { "mobile": { "spacing": { "padding": { "top": "$space.12", "bottom": "$space.12" } } } }
      },
      "source": { "template": "buildr/hero", "version": 1 }
    },
    "H1a2b3c4d5": {
      "id": "H1a2b3c4d5", "type": "buildr/heading",
      "props": {
        "text": { "kind": "binding", "path": "page.title", "fallback": "Untitled" },
        "level": { "kind": "static", "value": 1 }
      }
    }
  }
}
```

## Fragment and authoring formats

```ts
// Transport format: clipboard, template insertion, protocol "insert"
export interface BuilderFragment {
  format: 'buildr/fragment';
  schemaVersion: 1;
  components: Record<ComponentType, number>;
  roots: NodeId[];                       // top-level nodes of the fragment
  nodes: Record<NodeId, PageNode>;
}

// Authoring format: templates, tests, seeds. Never persisted as-is.
export interface TreeNode {
  type: ComponentType;
  props?: Record<string, Value>;
  styles?: NodeStyles;
  children?: TreeNode[];                 // sugar for slots.default
  slots?: Record<SlotName, TreeNode[]>;
  name?: string; anchor?: string; lock?: PageNode['lock']; region?: string;
}
// fromTree(tree, idGen) → BuilderFragment;  toTree(doc, nodeId) → TreeNode;  reId(fragment, idGen) → BuilderFragment
```

## Serialization and versioning

`serializeDocument` is a stable stringify (sorted keys, no `undefined`/empty objects) used for content hashes (CSS cache, manifest hash, snapshot tests). Storage may reorder keys freely — that has no semantic meaning.

There are **two independent version axes**: `schemaVersion` (the document shape, migrated in `core/migrations/document`) and `components[type]` (a component's prop schema, migrated alongside the component's own definition). Both are forward-only, pure and deterministic (see [`migrations.md`](migrations.md) and [ADR-014](adr/ADR-014-schema-migrations.md)).

## Validation

`validateDocument(input, { registry, theme?, locales?, dataSchema?, limits? })` (`@next-buildr/core`) checks a document that came from outside — the database, an import, a migration — and returns `{ ok, issues, doc }`. It never throws.

Every issue is a `Diagnostic` with an extra `blocking` flag. `ok` is `false` only when something blocking was found; the rest is reported so the editor can show it and rendering can fall back.

| Blocking (`ok: false`) | Not blocking |
|---|---|
| envelope, byte-size and structural limits (`parseDocument`) | `validation.unknown-component`, `validation.component-outdated` |
| invariants (`document.*`) | `validation.unknown-slot`, `slot-min`, `slot-max`, and the placement reasons (`validation.slot-denied`, `parent-not-allowed`, `missing-required-ancestor`, …) |
| `validation.component-version-ahead` (written by newer code) and `validation.missing-component-version` | `validation.unknown-prop`, `missing-required-prop`, `invalid-prop-value`, `invalid-value-shape`, `not-bindable`, `not-localizable` |
| | `validation.unknown-locale` (warning) — an `l10n` key that is not in `LocaleConfig` |
| | `validation.unknown-binding-path`, `expr.*` — bindings and expressions against `dataSchema` (skipped without one) |
| | `style.*` — from the style compiler |

Nesting uses the same `checkPlacement` as `canInsert`, so a document built only by commands never fails it. Expressions and bindings that read a Loop's `item`/`index`/`loop` are not checked against the schema unless the schema declares those scopes, since their type depends on the list being iterated.
