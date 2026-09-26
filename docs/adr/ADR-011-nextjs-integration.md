# ADR-011: Next.js integration

**Status:** Accepted

## Context

Production pages must ship zero builder JavaScript when they contain no client components, must integrate with the App Router's caching/revalidation model, and must support draft/preview mode without special-casing every route.

## Options

1. **A fully client-rendered page component** — simplest to build, but ships JS for every page regardless of content, and can't use `generateMetadata`/`generateStaticParams` naturally.
2. **An async React Server Component page (`BuildrPage`)** that runs the full pipeline (migrate → `prepareRender` → `compileStyles` → `renderTree`) server-side, sending client JS only for the actual client components used on that page.
3. **Cache strategy**: manual `unstable_cache`/ISR vs. tag-based revalidation driven by Payload write hooks.

## Decision**

`BuildrPage` is an **async Server Component**. A `Platform` object (injected `next/link`, `next/image`, form action wiring) is passed into the renderer so components stay framework-agnostic at the `@next-buildr/react` layer. Caching uses **tag-based revalidation**: reads are tagged (`buildr:doc:{collection}:{id}`, `buildr:col:{collection}`, …) and Payload's `afterChange`/`afterDelete` hooks call `revalidateTag` on publish.

## Consequences

- A page built entirely from `runtime: 'shared'` components ships **zero** builder JavaScript — verified by an explicit E2E assertion (task PB-112).
- Draft mode, `generateMetadata` and `generateStaticParams` compose naturally with an async RSC page.
- The integration is pinned to a documented Next.js version range (`^15.4 || ^16`) and re-verified nightly against both, isolating Next API churn to `packages/next/`.
