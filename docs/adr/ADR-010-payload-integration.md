# ADR-010: Payload integration

**Status:** Accepted

## Context

Payload must be the storage/workflow layer (drafts, autosave, versions, publish, media, auth), not the editor itself, while giving editors of Payload documents a frictionless "Edit with Visual Builder" entry point.

## Options

1. **A hidden JSON field with no field UI** — simplest, but a raw JSON editor in the admin is a poor experience and invites accidental corruption.
2. **A custom Payload admin *view*** replacing the document form — rejected, contradicts the "editor is a separate product" requirement.
3. **A JSON field + a custom field component (summary + button) + dedicated REST endpoints + hooks, packaged as a plugin.**

## Decision**

`buildrPlugin()` adds: a `layout` JSON field (+ hidden `buildrRevision` for optimistic concurrency) to configured collections, a custom field UI (`LayoutField`) showing a summary and an "Edit with Visual Builder" button that opens `/buildr/edit/{collection}/{id}` in a named browser tab/window, a documented set of `/api/buildr/*` endpoints (contract in `packages/payload/src/contract.ts`), a `beforeChange` **write-guard** hook that only accepts writes to `layout`/`buildrRevision` when `req.context.buildrWrite === true` (protecting against the admin form re-submitting the stale `layout` it loaded), and a `buildr-templates` collection for collection-level default/reusable layouts.

## Consequences

- Drafts, autosave-vs-save, versions and publishing reuse Payload's own mechanisms end to end — no duplicate persistence model.
- The write-guard is the single most safety-critical piece of the integration (risk R2 in the backlog) and has a dedicated, mandatory integration test: concurrent admin-form save + builder autosave must not lose data.
- Publishing from the builder publishes the **entire** document, including fields edited in the admin — surfaced explicitly in the publish dialog's copy.
