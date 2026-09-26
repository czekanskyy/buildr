---
"@next-buildr/mcp": minor
---

Add the `buildr-mcp` stdio CLI (PB-141, `@next-buildr/mcp/cli`): `--url <site>` with the API key from `BUILDR_API_KEY` (through the optional peer `@next-buildr/payload/mcp`), or `--playground <dir>` on JSON files; `--allow-publish` enables publishing. Logs go to stderr. The built-in component catalogue fixture is now published in `files`.
