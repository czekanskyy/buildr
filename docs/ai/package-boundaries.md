# Package and module boundaries

Mechanically enforced by `pnpm check:boundaries` (dependency-cruiser), not just documented here — a violation fails CI. See also [architecture-rules.md](architecture-rules.md) for the high-level dependency direction.

## Package-level import table

| Package | May import | Must not import |
|---|---|---|
| `core` | `zod`, `immer` (only inside `commands/`) | `react`, `react-dom`, `next`, `payload`, ambient `window`/`document` (outside `protocol/`, and only via injected interfaces there), any `@buildr/*` package |
| `react` | `@buildr/core`, `react`, `react-dom` | `next`, `payload`, `@buildr/editor`, `@buildr/components`, `@buildr/next`, `@buildr/payload` |
| `components` | `@buildr/core`, `@buildr/react`, `react` | `next`, `payload`, `@buildr/editor`, `@buildr/next`, `@buildr/payload` |
| `editor` | `@buildr/core`, `react`, `react-dom`, `zustand`, `@radix-ui/*`, `lexical`, `@tanstack/react-virtual`, `lucide-react` | `@buildr/react`, `@buildr/components`, `next`, `payload`, `@buildr/next`, `@buildr/payload` |
| `next` | `@buildr/core`, `@buildr/react`, `next`, `react`; the `./editor` subpath additionally imports `@buildr/editor` (peer) | `payload`, `@buildr/payload`, `@buildr/components` |
| `payload` (`./plugin`, `./data`, `./admin`) | `@buildr/core`, `payload`, `@payloadcms/ui` (admin only) | `@buildr/editor`, `@buildr/components`, `@buildr/react` (except where a type-only import is needed from `./data`) |
| `payload` (`./adapter`) | `@buildr/core` | `payload`, `@payloadcms/*`, `next`, `@buildr/next` |
| `payload` (`./next`) | `@buildr/core`, `@buildr/next`, `next`, `payload` | `@buildr/editor` |
| `payload` (`./mcp`, `./mcp/route`) | `@buildr/core`, `@buildr/mcp` (types and backend tests), `./contract`; `mcp/route.ts` (the separate `./mcp/route` entry, so the stdio CLI never loads `payload`) additionally `@modelcontextprotocol/sdk`, `@buildr/next`-free `next` and `payload` (the site route handler) | `payload`, `@payloadcms/*`, `next` (all except `route.ts`), `@buildr/editor`, `@buildr/react`, `@buildr/components` |
| `mcp` | `@buildr/core`, `@modelcontextprotocol/sdk`, `zod` | `react`, `react-dom`, `next`, `payload`, every other `@buildr/*` package |
| `mcp` (`./cli`) | as `mcp`, plus `@buildr/payload/mcp` only through an optional peer dependency (dynamic import) | `react`, `next`, `payload` |

## Module ownership inside each package

| Module | Owner package | Public API | Internal | Allowed imports | Forbidden imports | Tests | Extra DoD |
|---|---|---|---|---|---|---|---|
| `core/document` | core | Types, `documentSchema`, `createEmptyDocument`, `createIndex`, `walk`, `assertDocumentInvariants`, `fromTree`, `toTree`, `extractFragment`, `reId` | Index caching | L0, zod | Other core modules | Unit + fixture corpus | 100% of invariants covered by negative tests |
| `core/schema` + `registry` | core | `p.*`, `DataType`, `ComponentMeta`, `createRegistryMeta`, `toManifest`, `manifestHash` | Kind validators | L0-L1 | `values`, `commands` | Unit | The manifest is deterministic |
| `core/data` + `values` + `prepare` | core | `DataSchema`, `getPath`, `DataSource`, `QuerySpec` (data); `Value`, helpers, `resolveValue`, `resolveProps` (values); `prepareRender`, `MemoryDataSource` (prepare) | Coercions, formatters | Per the L2/L3/L4 layering | `commands`, `styles` | Unit + property + `DataSource` contract tests | Never throws; every diagnostic carries a `nodeId` |
| `core/expressions` | core | `parse`, `print`, `evaluate`, `typecheck`, `compileTemplate`, `stdlib` (the function list) | Lexer, Pratt parser | L0, `DataType`, `data` (`DataContext`, `getPath`) | Everything else | Unit + property + fuzz | Every resource limit has a test |
| `core/styles` | core | `NodeStyles`, `defineTheme`, `compileStyles`, `compileTokens`, `effectiveStyle`, `styleProperties` | Grammar | L0-L1 | `values`, `commands` | Unit + snapshot | CSS output is deterministic |
| `core/rules` + `dnd` + `templates` | core | `canInsert`, `canMove`, `canRemove`, `computeDropTarget`, `defineTemplate`, `instantiateTemplate` | Matchers | L0-L2 | `commands` | Unit (tabular) | Every rejection reason has a test |
| `core/commands` | core (`./commands`) | `execute`, `executeBatch`, `canExecute`, command types, `createHistory` | Handlers | L0-L3, immer | `a11y`, `validation`, `protocol` | Unit + property | `undo . do = id` (property test) |
| `core/validation` + `a11y` | core | `validateDocument`, `runA11y`, `a11yRules` | Rule implementations | L0-L3 | `commands` | Unit (a positive and a negative fixture per rule) | Every rule has both fixtures |
| `core/protocol` | core (`./protocol`) | Message schemas, `createParentTransport`, `createChildTransport` | Request/response queues | L0, document types, zod | `commands` | Unit (MessageChannel) | Origin/source/session rejection tests |
| `react/render` | react | `defineComponent`, `renderTree`, `renderDocument`, `DocumentRenderer`, `BuildrStyles`, `richTextConverters` | The tree walker | core | `next`, `payload`, `editor`, `components` | Renderer SSR snapshot | No hooks/context on the shared render path |
| `react/canvas` | react (`./canvas`) | `CanvasRuntime` | Overlay, inline edit, hit-testing | core, `core/commands` (`applyDocumentPatches`), `core/protocol`, `react/render` | `editor`, `next`, `payload` | jsdom + E2E | Works in both the playground and the example app |
| `components` | components | Definitions, `createDefaultRegistry`, `defaultTheme`, `templates`, `styles.css` | Views | core, react | `next`, `payload`, `editor` | Component + a11y + visual | See the component Definition of Done |
| `editor/store` + `persistence` | editor | `DocumentAdapter` (the type) | Slices, autosave | core, `core/commands` | Panel internals, `canvas-host` internals | Unit + integration (fake timers) | Mutations only ever go through commands |
| `editor/canvas-host` | editor | (none, internal) | Transport, sync | store, `core/protocol` | Panels | Integration | Handshake, resync, reload all covered |
| `editor/panels` + `toolbar` + `shortcuts` + `clipboard` | editor | (none, internal) | Controls | store, ui, core's public API | core internals, `canvas-host` internals | Integration | Full keyboard operability, accessible labels |
| `editor/dnd` | editor | (none, internal) | The drag engine | store, `core/dnd`, `core/rules`, the `canvas-host` API | Panel internals | Unit + E2E | Forbidden drops show a message |
| `next` | next | `BuildrPage`, `createNextPlatform`, `buildrMetadata`, `./draft`, `./canvas`, `./editor` | Boundary glue | core, react, next | `payload`, `components` | E2E (example app) | RSC-compatible; no `'use client'` leaks |
| `payload/plugin` + `data` + `admin` | payload | `buildrPlugin`, `PayloadDataSource`, `LayoutField`, `contract` | Hooks, endpoints | core, payload, `@payloadcms/ui` | `editor`, `components` | Payload integration (SQLite) | Write-guard, access control, 409/422 all covered |
| `payload/adapter` | payload | `createPayloadAdapter`, `createPayloadCanvasDataSource` | The fetch client | core, `contract` | `payload`, `next` | Unit (mock fetch) | Matches `contract.ts` exactly |
| `payload/next` | payload | `getBuildrDocument`, `revalidateHooks`, `listPublishedSlugs` | Tag helpers | core, the next adapter, next, payload | `editor` | E2E | Tags follow the documented convention |
| `mcp` (tools, sessions, serialize) | mcp | `createBuildrMcpServer`, `McpBackend`, `createMemoryBackend` | Tools, edit sessions, serialization | core, `core/commands`, the MCP SDK, zod | React, next, payload, other `@buildr/*` | Unit + integration (in-memory MCP client), backend contract suite | Every mutation is one `executeBatch`; see ADR-024 |
| `payload/mcp` | payload (`./mcp`) | `createPayloadMcpBackend`, `createBuildrMcpRoute` | The fetch client | core, `@buildr/mcp`, `contract` (route: next, payload) | `editor`, `react`, `components` | Unit (mock fetch), contract suite, example-app integration | The API key never appears in errors or logs |

This table is the basis for how multiple agents can work in different modules concurrently without stepping on each other — see [task-workflow.md](task-workflow.md).
