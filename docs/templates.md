# Templates (composite components)

See also [ADR-020](adr/ADR-020-composites.md) and the "Composites" section of [component-registry.md](component-registry.md).

## Model

| Concept from the product brief | Implementation |
|---|---|
| Composite definition | `TemplateDefinition` (id, version, label, thumbnail, lock, variants) |
| Template | `tree: TreeNode`, built from ordinary registered components |
| Slots | Ordinary component slots (e.g. Card's `media`/`body`/`actions`), plus **regions** (`region`) that reopen editing inside an otherwise locked subtree. No separate `Slot` component is needed. |
| Children | Ordinary `slots.default` |
| Preset | A template with a single node (e.g. "Primary button") |
| Editable structure | Fully editable by default (a detached copy). `lock.structure` blocks add/remove/move outside declared regions. `lock.content` blocks prop edits. Unlocking requires the `unlockTemplates` permission. |

```ts
export interface TemplateDefinition {
  id: string; version: number; label: string; category: string; thumbnail?: string;
  lock: 'none' | 'structure';
  variants?: Record<string, TreeNode>;
  tree: TreeNode;
}
```

`instantiateTemplate(def, variant?, idGen)` returns a `BuilderFragment`: fresh IDs are minted on every call, the fragment root gets a `source: { template: def.id, version: def.version }` marker and, if `lock === 'structure'`, a `lock.structure: true` flag. The result is validated by `canInsert` exactly like any other inserted fragment.

## Locks and regions

`findLockRoot(doc, index, nodeId)` walks up from a node to the nearest ancestor with `lock.structure`. `isInsideRegion(doc, index, nodeId)` checks whether any node between that lock root and the target carries a `region` marker — if so, structural commands are allowed there even though the surrounding subtree is locked. This lets a Hero template protect its overall two-column layout while still allowing the "Actions" button group inside it to be freely edited.

## What templates are not

There is no "propagate a template change to existing instances" feature. Once inserted, a template instance is an ordinary part of the document — editing the original `TemplateDefinition` in code has no effect on documents that already instantiated it. This is a deliberate MVP trade-off (see ADR-020); linked, synchronized symbols are a v0.3 addition (`buildr/symbol`), built without needing to change this model.

## Writing a new template

1. Compose the `tree` entirely from components already in the target registry.
2. Add responsive overrides (`styles.bp.tablet` / `styles.bp.mobile`) directly on the relevant nodes.
3. Mark editable-but-protected areas with `region` if the template should ship with `lock: 'structure'`.
4. Add a thumbnail SVG.
5. Verify the instantiated fragment passes `validateDocument` and `runA11y` with zero errors, and looks correct at all three breakpoints (see the component/template Definition of Done in [`ai/component-development.md`](ai/component-development.md)).
6. Add an entry to [`components.md`](components.md).
