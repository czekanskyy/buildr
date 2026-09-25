// Public entry point of @buildr/mcp (ADR-024, docs/mcp.md): the McpBackend seam, the memory backend
// and the server factory. Sessions, serialization and the tools follow in PB-134 - PB-138.

export * from './backend.ts';
export {
  createMemoryBackend,
  type MemoryBackendOptions,
  type MemoryDocumentInput,
} from './backends/memory.ts';
export {
  type CreateFullBuildrMcpServerInput,
  createBuildrMcpServerWithTools,
  type FullBuildrMcpServer,
} from './default-server.ts';
export { createPrompts } from './prompts/index.ts';
export {
  createDiscoveryCache,
  createResources,
  type DiscoveryCache,
  GUIDE_URI,
} from './resources/index.ts';
export * from './serialize/index.ts';
export {
  type BuildrMcpServer,
  type BuildrMcpServerOptions,
  type CreateBuildrMcpServerInput,
  createBuildrMcpServer,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_SERVER_NAME,
  type McpPrompt,
  type McpPromptArgument,
  type McpPromptMessage,
  type McpPromptResult,
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
export { createDocumentTools, type ToolFactoryOptions } from './tools/documents.ts';
export { createEditingTools } from './tools/editing.ts';
export { type BuildrToolsOptions, createBuildrTools } from './tools/index.ts';
export {
  createPersistenceTools,
  type PersistenceToolOptions,
} from './tools/persistence.ts';
export {
  collectQuality,
  createQualityTools,
  publishGate,
  type QualityIssue,
  type QualityReport,
} from './tools/quality.ts';
export { renderToolReference } from './tools/reference.ts';
export { MCP_SERVER_VERSION } from './version.ts';
