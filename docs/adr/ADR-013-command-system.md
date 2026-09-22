# ADR-013: Command system

**Status:** Accepted

## Context

Document mutation must be testable, debuggable, loggable and replayable, and must be the **only** path to changing a document — no direct store mutation from UI code.

## Options

1. **Direct store mutations from UI components/reducers** — the common React pattern, but not serializable, not replayable, and makes it easy for UI code to accidentally bypass validation/locks.
2. **Serializable command objects**, each with a `validate` and an `apply`, dispatched through a single `execute`/`executeBatch` entry point in `@buildr/core/commands`.

## Decision**

All document mutation goes through **commands**: `{ type, payload }` objects with a registered `CommandHandler { validate, apply }`. `execute`/`executeBatch`/`canExecute` are the only functions that touch the document. Commands are plain JSON, enabling logging, replay (`replay(doc, commands)`), and property-based testing over random command sequences.

## Consequences

- Every mutation path (editor UI, canvas-forwarded intents, clipboard paste, programmatic scripts) funnels through the same validated, tested surface — this is enforced by AGENTS.md rule #4 and, mechanically, by the fact that `PageNode`/`BuilderDocument` fields are not otherwise mutable from outside `core/commands`.
- A full audit/debug trail (a ring buffer of the last 500 commands) is nearly free once commands are the only mutation path.
- New editor features that "just" need to change the document must add or reuse a command — they cannot reach into the store's document slice directly.
