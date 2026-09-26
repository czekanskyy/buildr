// `@next-buildr/mcp/cli`: the pieces of the `buildr-mcp` stdio CLI (docs/mcp.md#stdio-cli).
export { type CliOptions, type ParsedArgs, parseArgs, USAGE } from './args.ts';
export {
  createFileBackend,
  type FileBackendOptions,
  loadDefaultManifest,
} from './file-backend.ts';
export { apiBaseUrl, type CliIo, type RunningCli, runCli } from './main.ts';
