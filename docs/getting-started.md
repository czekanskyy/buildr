# Getting started

> This page describes the target developer experience. It will be verified end to end (and corrected if reality drifts from it) as part of task PB-114, the MVP release task — until then, treat commands here as the intended contract, not yet a tested one.

## Prerequisites

- Node.js >= 22 LTS
- pnpm >= 10
- Git

## Working on Buildr itself

```bash
git clone <repo-url> buildr
cd buildr
pnpm install
pnpm dev            # apps/playground: editor + canvas + the fixture gallery, no Next.js or Payload needed
```

```bash
pnpm dev:example     # apps/example-next-payload: the full Next.js + Payload reference integration
```

```bash
pnpm test            # all tests (turborepo, affected-aware)
pnpm typecheck
pnpm lint
pnpm check:boundaries # architectural import rules (dependency-cruiser)
```

## Using Buildr in your own Next.js + Payload project

Once 0.1.0 is published, the target flow is:

1. Install the packages you need: `@buildr/core @buildr/react @buildr/components @buildr/editor @buildr/next @buildr/payload`.
2. Add `buildrPlugin({ ... })` to your Payload config (see [payload.md](payload.md)).
3. Define your component registry and theme in `buildr.registry.ts` and pass them to `createBuildrConfig` in `buildr.server.ts` (see [nextjs.md](nextjs.md)).
4. Add the page, canvas and editor routes shown in [nextjs.md](nextjs.md#application-routes).
5. Open a document in Payload Admin and click "Edit with Visual Builder".

Full package installation instructions, minimum version ranges, and a step-by-step walkthrough will be finalized and verified in task PB-114.
