import { createBuildrMcpRoute } from '@buildr/payload/mcp/route';
import config from '@payload-config';
import { getPayload } from 'payload';
import { registry, theme } from '../../../../../buildr.registry.ts';

// The remote MCP server (docs/mcp.md): answers 404 unless the plugin has `mcp.enabled` (BUILDR_MCP=1).
export const { POST, GET, DELETE } = createBuildrMcpRoute({
  payload: () => getPayload({ config }),
  registry,
  theme,
});
