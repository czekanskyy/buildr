---
"@buildr/mcp": patch
---

Add the agent-eval harness (PB-145): `packages/mcp/evals` briefs, a rule-based scorer and a runner that drives the stdio server with a real model when `ANTHROPIC_API_KEY` is set (`pnpm --filter @buildr/mcp eval`). It is not published and adds no dependency (the Anthropic SDK is loaded dynamically by whoever runs the evals). The scripted MCP-client end-to-end suite lives in `apps/example-next-payload/e2e/mcp`.
