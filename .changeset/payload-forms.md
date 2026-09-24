---
"@buildr/payload": minor
---

Forms (PB-102): `forms.enabled` adds the `buildr-form-submissions` collection and the public `POST /buildr/forms/:collection/:id/:nodeId`. The schema is derived from the published layout (or its template) with `deriveFormSchema`, so the client cannot change what is accepted. Honeypot, rate limiting (`RateLimiter`, `createMemoryRateLimiter`), an email notification to an allowlisted set (`forms.notifyTo`) and a JSON or `303` answer. New options `forms.notifyTo`, `forms.rateLimit`, `forms.rateLimiter`.
