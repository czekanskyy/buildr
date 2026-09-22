# ADR-022: License

**Status:** Accepted (owner decision, 2026-09-21)

## Context

The project needs a license that maximizes adoption in client/agency projects (where MIT-licensed dependencies are the norm and legal review friction matters) while keeping contribution friction low.

## Options

1. **MIT** — maximally permissive, no patent grant clause, matches the license of React, Next.js and Payload themselves; no CLA needed.
2. **Apache-2.0** — permissive with an explicit patent grant, but adds a `NOTICE`-file obligation and is GPLv2-incompatible.
3. **MPL-2.0** — file-level copyleft (changes to *our* files must stay open, but consumers' own components can remain closed) — meaningful protection, but adds legal friction in corporate adoption.
4. **AGPL-3.0 (+ a commercial license)** — protects against closed-source SaaS forks, but in practice blocks use in typical client-site projects and requires a CLA.
5. **BSL/FSL (source-available, delayed open source)** — gives commercial control, but is not OSI-approved open source, contradicting the project's stated goal.

## Decision**

**MIT, for every package, with no CLA.** If a commercial, hosted offering (e.g. a managed editor service) is built in the future, it will live in a separate repository; the library itself stays MIT. The project name is protected via a trademark policy published alongside the first release, not via license restriction.

## Consequences

- Maximum adoption in agency/client work, matching the license of the surrounding ecosystem.
- No CLA lowers the barrier for external contributors — but also means the project cannot later relicense contributed code without contributor consent, if that's ever needed.
- No copyleft protection against closed-source forks — accepted as the right trade-off for this project's goals.
