// `@next-buildr/mcp/testing`: the reusable backend contract suite and test fixtures. Imports `vitest`
// (an optional peer dependency), so import this subpath from test files only.

export {
  type BackendContractOptions,
  type BackendContractSubject,
  runBackendContract,
} from './contract.ts';
export {
  createTestManifest,
  createTestMemoryBackend,
  TEST_COLLECTION,
  TEST_DATA_SCHEMA,
  TEST_MEDIA,
} from './fixtures.ts';
export {
  CORE_TOOL_NAMES,
  runToolScenario,
  type ScenarioClient,
  type ToolScenarioOptions,
  type ToolScenarioResult,
} from './scenario.ts';
