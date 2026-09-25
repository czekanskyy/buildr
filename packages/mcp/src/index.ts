// Public entry point of @buildr/mcp (ADR-024, docs/mcp.md): the McpBackend seam, the memory backend
// and the server factory. Tools, sessions and serialization arrive in PB-134 - PB-138.

export * from './backend.ts';
export {
  createMemoryBackend,
  type MemoryBackendOptions,
  type MemoryDocumentInput,
} from './backends/memory.ts';
export {
  createDiscoveryCache,
  createResources,
  type DiscoveryCache,
} from './resources/index.ts';
export * from './serialize/index.ts';
export {
  type BuildrMcpServer,
  type BuildrMcpServerOptions,
  type CreateBuildrMcpServerInput,
  createBuildrMcpServer,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_SERVER_NAME,
  type McpResourceContents,
  type McpResourceDefinition,
  type McpResources,
  type McpResourceTemplate,
  type McpTool,
  type McpToolAnnotations,
  type McpToolContext,
  type McpToolResult,
} from './server.ts';
export * from './session/index.ts';
export { createDiscoveryTools } from './tools/discovery.ts';
export { MCP_SERVER_VERSION } from './version.ts';
