# ADR-023: Localization

**Status:** Accepted (owner decision, 2026-09-21)

## Context

The product must support multi-language client sites in the MVP itself (not deferred), without forcing authors to rebuild page structure per language, and without a later migration once real localized documents already exist in production.

## Options

1. **A separate `layout` document per language** (Payload's `localized: true` on the `layout` field itself) — the "obvious" approach, but means every structural or style change has to be repeated per language, and drifting layouts between languages become an ongoing maintenance burden.
2. **One shared structure, translations stored *inside* the AST** (`StaticValue.l10n` per locale, template-mode `ExpressionValue.l10n`), with CMS-sourced data (bindings) fetched in the active locale via Payload's own field localization.
3. **An external TMS (translation management system) integration** — solves workflow (assignment, review, XLIFF export) but doesn't solve the core structural question; deferred to v0.2 as an addition on top of option 2, not an alternative to it.

## Decision**

**One shared page structure; translated content lives inside the value model.** `StaticValue<T>` gains an optional `l10n: Partial<Record<LocaleCode, T>>` map (the un-suffixed `value` is the default-locale value); template-mode `ExpressionValue` gains the equivalent for its template source. Bound values are unaffected — the same binding path is resolved against CMS data fetched in the active locale via Payload's own `localized` fields. Built-in component strings (e.g. "opens in a new tab", pagination labels, form messages) ship in a `messages` catalog per locale, passed through `env.messages`, never hard-coded. This model exists from `schemaVersion: 1` — no future migration is needed to introduce it. Per-language layouts (option 1) remain available later as an **opt-in** plugin option (v0.3), for the rare case a client genuinely needs a structurally different page per language, without being the default.

## Consequences

- Structural and style edits apply to every language simultaneously — the common case for most sites, and a strong argument against the option-1 drift problem.
- The editor needs a locale switcher and a visible affordance for "this value has no translation yet" (`missing-translation` a11y-adjacent rule, `info` severity) — task PB-115.
- `layout` itself is **not** a `localized` Payload field; only business fields (`title`, `slug`, `excerpt`, `content`, SEO meta, media `alt`) are — task PB-116.
- Next.js routing needs a `[locale]` segment, a locale-negotiating middleware, and `hreflang` generation — task PB-117.
