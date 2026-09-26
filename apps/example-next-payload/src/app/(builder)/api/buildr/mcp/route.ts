import { createBuildrMcpRoute } from '@next-buildr/payload/mcp/route';
import config from '@payload-config';
import { getPayload } from 'payload';
import { MCP_RATE_LIMIT } from '../../../../../buildr.options.ts';
import { registry, theme } from '../../../../../buildr.registry.ts';

// The remote MCP server (docs/mcp.md): answers 404 unless the plugin has `mcp.enabled` (BUILDR_MCP=1).
export const { POST, GET, DELETE } = createBuildrMcpRoute({
  payload: () => getPayload({ config }),
  registry,
  theme,
  // Requests per agent and minute; the end-to-end suite lifts it (BUILDR_MCP_RATE_LIMIT).
  ...(MCP_RATE_LIMIT === undefined ? {} : { rateLimit: MCP_RATE_LIMIT }),
});
