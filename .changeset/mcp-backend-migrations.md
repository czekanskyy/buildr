---
"@next-buildr/mcp": minor
---

Add optional component migrations to the memory and file backends. Stored documents migrate on load; incompatible or unknown component versions remain read-only with reasons in document output, and writes are refused. Update the bundled catalogue, guide and fixtures to use Container v2.
