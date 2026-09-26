---
"@next-buildr/core": minor
---

Add document invariants (PB-009): `checkInvariants(doc)` detects a corrupted document — a missing or mis-typed root, a map key that doesn't match its node's `id`, a node with zero or multiple parents, a cycle, a dangling slot reference, and duplicate `anchor` values — and `assertDocumentInvariants(doc)`, a dev/test-only assert built on it.
