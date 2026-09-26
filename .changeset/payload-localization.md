---
"@next-buildr/payload": minor
---

Localization (PB-116): the `locale` parameter of the documents, data (`context`, `query`, `media`), samples, media and forms endpoints is validated against Payload's `localization` (`400` for an unknown code) and mapped to the Local API, including `fallbackLocale: false` when the fallback is off. `route.locale` is the requested (or default) language, form submissions record it, and `l10n` keys outside the site's locales are reported when a layout is saved, published or written. Without localization nothing changes. New `localeConfigOf` and `configuredLocales`.
