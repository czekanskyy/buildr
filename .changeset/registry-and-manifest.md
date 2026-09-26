---
"@next-buildr/core": minor
---

Add the registry (metadata) and the manifest (PB-015): `createRegistryMeta({ components, templates })` builds an immutable `RegistryMeta` (`get`/`has`/`list`/`byCategory`/`extend` over `ComponentMeta`, plus `getTemplate`/`hasTemplate`/`listTemplates` over the new `TemplateDefinition`), validating at construction time and throwing on a duplicate type/id or an invalid `ComponentMeta`. `toManifest(registry)` projects it into a `RegistryManifest` (`{ hash, components, templates }`, no functions), `manifestHash(registry)` computes just the hash, and `fromManifest(input) -> Result<RegistryManifest, Diagnostic[]>` validates one arriving over an untrusted boundary (Zod).
