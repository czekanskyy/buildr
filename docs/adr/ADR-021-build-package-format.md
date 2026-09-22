# ADR-021: Build & package format

**Status:** Accepted

## Context

Packages must build correctly for React Server Components — meaning `'use client'` directives must survive bundling at the *module* boundary, not get merged or stripped — while keeping local development fast (no watch-build step needed just to run the playground).

## Options

1. **A bundler** (tsup/tsdown/esbuild) producing single-file outputs per entry — fast, but bundlers frequently hoist/merge modules in ways that lose per-module `'use client'` directive placement, which is load-bearing for RSC correctness.
2. **`tsc -b`, per-file emission, ESM-only**, source files consumed directly during development (via `exports` pointing at `src/*.ts`, resolved natively by Vite and by Next's `transpilePackages`) and compiled output consumed by published packages (via `publishConfig.exports` pointing at `dist`).

## Decision**

Build with **`tsc -b`**, emitting one output file per input file (ESM-only, no CJS). This guarantees `'use client'` directives stay exactly where the author put them — one file, one directive, no bundler free to merge them away. CSS is copied by a small script rather than processed. During development, workspace packages are consumed as source (fast iteration, no build step in the loop); `pnpm pack`/publish switches consumers to the compiled `dist` output via `publishConfig`.

## Consequences

- No CommonJS output — consumers must be ESM-capable (true of current React/Next/Payload tooling; explicitly documented as a requirement).
- Slightly larger published package (many small files vs. one bundle) in exchange for RSC correctness that a bundler cannot reliably guarantee.
- `publint` and `@arethetypeswrong/cli` run in CI specifically to catch package-export mistakes this approach is otherwise prone to.
