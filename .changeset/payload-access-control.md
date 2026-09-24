---
"@buildr/payload": minor
---

Payload access control and CSRF guards (PB-096): `access.edit` / `access.publish` / `access.unlockTemplates` enforced on the builder endpoints (`403`), `permissions.canUnlockTemplates` in the session response, and `Content-Type` / `Origin` checks on saves and publishes.
