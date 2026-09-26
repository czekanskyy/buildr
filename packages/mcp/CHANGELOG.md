# @next-buildr/mcp

## 1.0.0

### Minor Changes

- 3706537: Add the agent guide, prompts and a generated tool reference (PB-144): the markdown resource `buildr://guide` (page structure, templates vs trees, tokens and breakpoints, bindings, localization, accessibility, validate-then-save, what never to do), the prompts `build-page`, `add-section`, `translate-page` and `fix-issues` (`createPrompts`, served by `createBuildrMcpServerWithTools`) on a new SDK-free `options.prompts` seam (`McpPrompt`) that enables the `prompts` capability, and `renderToolReference`. The `styles` help of tree input now names the theme's `mobile` breakpoint.
- 5a91f2f: Add agent-facing serialization (PB-135), exported from `@next-buildr/mcp`: a token-efficient text and JSON outline of a (sub)tree (`renderOutline`, `outlineToJson`), node detail with every prop as a `Value` (`describeNode`), component descriptions with a minimal valid example and its placement (`describeComponent`), a described tree input schema with registry-aware validation (`createTreeInputSchema`, `parseTreeInput`, `treeInputJsonSchema`), and error rendering that turns rule and command rejections into one actionable sentence with the nearest valid alternatives (`explainReason`, `explainCommandError`, `explainSessionError`).
- 8e6a7e8: Add the discovery tools and resources (PB-136): `createDiscoveryTools()` (`list_components`, `describe_component`, `list_templates`, `describe_template`, `get_style_reference`, `get_data_schema`, `list_media`, all read-only), `createResources()` (`buildr://components/{type}`, `buildr://templates/{id}`, `buildr://style-reference`) and the SDK-free `options.resources` seam of `createBuildrMcpServer`. Answers are cached per manifest hash (`createDiscoveryCache`).
- 3c0ec8e: Add the document and editing tools (PB-137): `createDocumentTools({ store })` (`list_documents`, `create_document`, `open_document`, `get_outline`, `get_node`, `close_document`) and `createEditingTools({ store })` (`insert_nodes` with a tree or a template, `update_node`, `move_nodes`, `remove_nodes`, `duplicate_nodes`, `wrap_nodes`, `unwrap_node`, `apply_commands`, `undo`, `redo`). Every editing tool is one atomic core batch on the session's working copy and returns the new node ids and their outline.
- 47ce8e9: Add edit sessions (PB-134): `createEditSession` and `createSessionStore` give an agent a headless, command-driven working copy of a document (`apply` via `executeBatch`, `undo`/`redo`, `dirty` from the history cursor, `markSaved`), with a per-store idle TTL (30 min), a per-user session cap (5), the backend's node/byte limits and a pinned manifest hash.
- 4cf1226: Add the remote MCP server (PB-142): `createBuildrMcpRoute({ payload, registry })` from `@next-buildr/payload/mcp/route` returns Next.js route handlers for the Streamable HTTP transport (stateless, API-key only, origin validation, rate limiting, disabled unless `mcp.enabled`) that run the `@next-buildr/mcp` tools against a local, in-process backend. `@next-buildr/mcp/testing` exports `runToolScenario`, one scripted scenario for every transport. `@modelcontextprotocol/sdk` is a new optional peer of `@next-buildr/payload`.
- 2edccac: New package `@next-buildr/mcp`: the `McpBackend` interface (typed `McpError` results, Zod-validated shapes), `createMemoryBackend`, `createBuildrMcpServer` (an MCP `Server` with server info, capabilities and instructions; tools arrive in later releases), and the reusable backend contract suite `runBackendContract` under `@next-buildr/mcp/testing`.
- c552443: Add the validation, save and publish tools (PB-138, ADR-024): `validate` (structure, props, accessibility and missing translations per node, with suggested fixes), `save` (never overwrites on a conflict, maps rejected diagnostics to nodes), `publish` (opt-in, `confirm: true`, `publishPolicy: block` enforced) and `get_preview_url`; `createBuildrTools` and `createBuildrMcpServerWithTools` wire the complete tool set, resources and session store. The backend session gains an optional `publishPolicy`, which `GET /api/buildr/session` now reports from `a11y.publish`.
- 617150c: Add the `buildr-mcp` stdio CLI (PB-141, `@next-buildr/mcp/cli`): `--url <site>` with the API key from `BUILDR_API_KEY` (through the optional peer `@next-buildr/payload/mcp`), or `--playground <dir>` on JSON files; `--allow-publish` enables publishing. Logs go to stderr. The built-in component catalogue fixture is now published in `files`.

### Patch Changes

- ab2e1a8: Add the agent-eval harness (PB-145): `packages/mcp/evals` briefs, a rule-based scorer and a runner that drives the stdio server with a real model when `ANTHROPIC_API_KEY` is set (`pnpm --filter @next-buildr/mcp eval`). It is not published and adds no dependency (the Anthropic SDK is loaded dynamically by whoever runs the evals). The scripted MCP-client end-to-end suite lives in `apps/example-next-payload/e2e/mcp`.
- 8ab1a1b: Derive the reported server version from `package.json` instead of a hard-coded constant, so `MCP_SERVER_VERSION`, `buildr-mcp --version` and the MCP `serverInfo` can no longer drift from the released version.
- 1ba33ad: Rename the npm scope from @buildr to @next-buildr
- Updated dependencies [4bdbb99]
- Updated dependencies [82bdd80]
- Updated dependencies [037287f]
- Updated dependencies [35ed848]
- Updated dependencies [1190b2c]
- Updated dependencies [29589ff]
- Updated dependencies [71575c7]
- Updated dependencies [d145516]
- Updated dependencies [db7cd10]
- Updated dependencies [b15291b]
- Updated dependencies [96db603]
- Updated dependencies [e158655]
- Updated dependencies [1b196ba]
- Updated dependencies [89f165d]
- Updated dependencies [ea65a4f]
- Updated dependencies [c10493a]
- Updated dependencies [d761eef]
- Updated dependencies [ee256d5]
- Updated dependencies [037be06]
- Updated dependencies [c507cb0]
- Updated dependencies [c18c6ad]
- Updated dependencies [4beb4f2]
- Updated dependencies [b2bb3ed]
- Updated dependencies [d5e8202]
- Updated dependencies [f528850]
- Updated dependencies [4cf1226]
- Updated dependencies [c552443]
- Updated dependencies [f238e41]
- Updated dependencies [0533292]
- Updated dependencies [890b443]
- Updated dependencies [a573b16]
- Updated dependencies [0a9cf21]
- Updated dependencies [9608646]
- Updated dependencies [a23e2d8]
- Updated dependencies [180b576]
- Updated dependencies [47f962c]
- Updated dependencies [0600ad3]
- Updated dependencies [a459c8e]
- Updated dependencies [0900cbd]
- Updated dependencies [8bc176f]
- Updated dependencies [95344c1]
- Updated dependencies [1005ec0]
- Updated dependencies [a470b60]
- Updated dependencies [a51a360]
- Updated dependencies [078ce5e]
- Updated dependencies [3541752]
- Updated dependencies [5b3a053]
- Updated dependencies [9ec3ab4]
- Updated dependencies [6fe1551]
- Updated dependencies [7894e77]
- Updated dependencies [d4b20af]
- Updated dependencies [9504f2a]
- Updated dependencies [1ba33ad]
- Updated dependencies [27a98e1]
- Updated dependencies [bbd0e13]
- Updated dependencies [98682f1]
- Updated dependencies [89cadd5]
- Updated dependencies [3ec3fce]
- Updated dependencies [6d61340]
- Updated dependencies [00075b9]
- Updated dependencies [8927bba]
- Updated dependencies [2402292]
- Updated dependencies [b466583]
- Updated dependencies [d1a8c6f]
- Updated dependencies [024fc96]
  - @next-buildr/core@1.0.0
  - @next-buildr/payload@1.0.0
