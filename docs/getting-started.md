# Getting started

Verified end to end (PB-114): a clean clone, the seed and the production build are exercised by the `E2E` job of CI on every pull request.

## Prerequisites

- Node.js >= 22 LTS
- pnpm >= 10
- Git

## Try the reference application (about 5 minutes)

```bash
git clone https://github.com/czekanskyy/buildr.git
cd buildr
pnpm install
```

Create an administrator and the demo content (a SQLite file, `apps/example-next-payload/buildr-example.db`; set `DATABASE_URL` to use Postgres instead). Pick your own password; the account exists only in your local database.

```bash
# macOS / Linux / Git Bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='choose-a-password' pnpm --filter @buildr/example-next-payload seed
```

```powershell
# Windows PowerShell (inline VAR=value does not work there, see the section below)
$env:SEED_ADMIN_EMAIL = 'you@example.com'; $env:SEED_ADMIN_PASSWORD = 'choose-a-password'; pnpm --filter '@buildr/example-next-payload' seed
Remove-Item Env:SEED_ADMIN_EMAIL, Env:SEED_ADMIN_PASSWORD   # the variables stay set for the whole session
```

```bash
pnpm dev:example
```

1. Open <http://localhost:3000/pl> (or `/en`): the seeded landing page, a company page, a blog with pagination, a product page and a contact form.
2. Open <http://localhost:3000/admin>, sign in, open a page and click **Edit with Visual Builder**. The editor opens in its own tab.
3. Insert a component, change a style on the Mobile breakpoint, undo/redo, and switch the content language to translate. Changes autosave; **Publish** makes them live.

The seed is idempotent: running it again creates nothing. Environment variables (how to set them on Windows: [below](#environment-variables-on-windows-powershell)): `PAYLOAD_SECRET` (set your own outside development), `SQLITE_URL` / `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` (absolute URLs in metadata).

## Working on the playground

```bash
pnpm dev            # apps/playground: editor + canvas + the fixture gallery, no Next.js or Payload needed
```

## Checks

```bash
pnpm test            # all tests (turborepo, affected-aware)
pnpm typecheck
pnpm lint
pnpm check:boundaries # architectural import rules (dependency-cruiser)
pnpm e2e             # Playwright end-to-end tests of the example application
```

## Using Buildr in your own Next.js + Payload project

The packages are `@buildr/core @buildr/react @buildr/components @buildr/editor @buildr/next @buildr/payload` (plus `@buildr/mcp` for [AI agents](mcp.md)), versioned together and released as 1.0.0. Install them from npm; the wiring for every step is in `apps/example-next-payload`, which is the reference:

1. Add `buildrPlugin({ ... })` to your Payload config, with drafts enabled on the collections you list (`src/payload.config.ts`, `src/buildr.options.ts`; see [payload.md](payload.md)).
2. Define the component registry, theme and locales (`src/buildr.registry.ts`) and pass them to `createBuildrConfig` (`src/buildr.server.ts`; see [nextjs.md](nextjs.md)).
3. Add the public routes (`src/app/(frontend)/[locale]`), the editor route (`(builder)/buildr/edit/...`) and the canvas and preview routes (`(canvas)/buildr/...`), plus the security headers in `next.config.ts`.
4. Import the component stylesheet once in the layouts, run `pnpm generate:importmap` for the Payload admin, and seed or create a page.
5. Open the document in Payload Admin and click **Edit with Visual Builder**.

The components, their props and the templates are described in [components.md](components.md) and [templates.md](templates.md).

## Environment variables on Windows (PowerShell)

Documentation in this repository writes Unix-style inline variables, `VAR=value command`. That syntax works in bash, zsh and Git Bash, but **not in Windows PowerShell** (or `cmd.exe`). In PowerShell set the variable first, then run the command:

| Unix (bash, zsh, Git Bash) | Windows PowerShell |
|---|---|
| `BUILDR_MCP=1 pnpm dev:example` | `$env:BUILDR_MCP = '1'; pnpm dev:example` |
| `BUILDR_MCP=1 pnpm --filter @buildr/example-next-payload e2e` | `$env:BUILDR_MCP = '1'; pnpm --filter '@buildr/example-next-payload' e2e` |
| `UPDATE_MCP_DOCS=1 pnpm test --filter @buildr/mcp` | `$env:UPDATE_MCP_DOCS = '1'; pnpm test --filter '@buildr/mcp'` |
| `DATABASE_URL=postgres://... pnpm dev:example` | `$env:DATABASE_URL = 'postgres://...'; pnpm dev:example` |
| `unset BUILDR_MCP` | `Remove-Item Env:BUILDR_MCP` |

Notes:

- `$env:NAME = 'value'` lasts for the whole PowerShell session (every later command in that window sees it, and it is not visible to other windows). Unset it with `Remove-Item Env:NAME` when you are done; otherwise, for example, `BUILDR_MCP` keeps agents switched on for the next `pnpm dev:example`.
- Quote values that contain spaces or special characters with single quotes. Quote `@scope/name` filters (`'@buildr/mcp'`), because `@` is an operator in PowerShell.
- To make a variable permanent for your user, use `[Environment]::SetEnvironmentVariable('NAME', 'value', 'User')` and open a new terminal (not needed for this repository).
- Playwright and the example application read these variables from the environment of the process that starts them, so set them in the same window before `pnpm ... e2e`.
