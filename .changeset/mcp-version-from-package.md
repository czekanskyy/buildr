---
'@next-buildr/mcp': patch
---

Derive the reported server version from `package.json` instead of a hard-coded constant, so `MCP_SERVER_VERSION`, `buildr-mcp --version` and the MCP `serverInfo` can no longer drift from the released version.
