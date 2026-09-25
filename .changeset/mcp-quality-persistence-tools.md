---
"@buildr/mcp": minor
"@buildr/payload": minor
---

Add the validation, save and publish tools (PB-138, ADR-024): `validate` (structure, props, accessibility and missing translations per node, with suggested fixes), `save` (never overwrites on a conflict, maps rejected diagnostics to nodes), `publish` (opt-in, `confirm: true`, `publishPolicy: block` enforced) and `get_preview_url`; `createBuildrTools` and `createBuildrMcpServerWithTools` wire the complete tool set, resources and session store. The backend session gains an optional `publishPolicy`, which `GET /api/buildr/session` now reports from `a11y.publish`.
