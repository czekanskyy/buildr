# MCP server: building pages with AI agents

> Status: skeleton. The decisions are recorded in [ADR-024](adr/ADR-024-mcp-server.md); the implementation lands in phase 14 ([backlog](backlog/phase-14-mcp-server.md)). Sections are filled in by the tasks named below.

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI agent discover the component catalogue, read and change a page **through the same commands the editor uses**, validate it and save it as a draft. The server never calls an LLM itself: it exposes tools, and the client brings the model.

## Architecture

```
 MCP client (Claude Code / Desktop / other)
        |  stdio                         |  Streamable HTTP (+ API key)
        v                                v
 buildr-mcp CLI (@buildr/mcp/cli)    route handler in the site (@buildr/payload/mcp)
        \                                /
         +---- @buildr/mcp (tools, sessions, serialization) ----+
                         |  McpBackend
          +--------------+------------------+
          v                                 v
  HTTP backend (@buildr/payload/mcp)   memory / file backend
```

Packages and boundaries: [ai/package-boundaries.md](ai/package-boundaries.md). Scaffold and backend interface: PB-133.

## Installing and connecting

To be written in PB-141 (stdio CLI) and PB-142 (HTTP endpoint).

## Authentication

Payload API keys for a dedicated, low-privilege agent user (ADR-024, decision 3). To be written in PB-139.

## Tool reference

To be generated from the tool definitions (PB-144).

## Publishing

Disabled by default. Requires the plugin option `mcp.allowPublish`, the user's `canPublish` and `confirm: true`; `publishPolicy: block` is respected (ADR-024, decision 5).

## Security notes

- Content read from the CMS is data, not instructions.
- Use a least-privilege agent user and rotate its key.
- The API key is read from `BUILDR_API_KEY`, never from a flag.
