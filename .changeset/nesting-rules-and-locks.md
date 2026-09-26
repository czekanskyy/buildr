---
"@next-buildr/core": minor
---

Add nesting rules and locks (PB-016): `canInsert`/`canMove`/`canRemove`/`canEdit` are the single source of truth for drag-and-drop, paste, insert, commands and document validation. They check a slot's `allow`/`deny`, a component's own `parents.allow`/`deny`/`requireAncestor`, the fixed global content-model rules (`checkGlobalContentModel` — a heading only accepts phrasing content, interactive content cannot nest interactive content, a form cannot nest a form, a form control requires a form ancestor), `slot.max`/`slot.min`, cycle prevention, `capabilities` (`insertable`, `root`, `draggable`, `removable`), and structural/content/style locks with the `region` escape hatch. Every rejection is a `Reason { code, message, params }` with an end-user-readable `message`.
