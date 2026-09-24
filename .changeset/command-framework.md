---
"@buildr/core": minor
---

Add the command framework (PB-031) in `@buildr/core/commands`: `Command`, `CommandHandler` (`schema`, `validate`, `apply` on an Immer draft), `createCommandRegistry`, `execute` / `executeBatch` / `canExecute`, `replay`, `parseCommand` / `commandSchema`, `CommandError`, and `applyDocumentPatches` for the canvas. Results carry Immer `patches` and `inverse`; batches are atomic; a dev-mode invariant check rejects a handler that corrupts the document. Adds `immer` as a dependency of `@buildr/core` (used only inside `commands/`, per `docs/ai/package-boundaries.md`).
