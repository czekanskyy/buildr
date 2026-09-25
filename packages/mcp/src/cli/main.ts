import type { McpBackend } from '../backend.ts';
import { createBuildrMcpServerWithTools } from '../default-server.ts';
import { serveStdio } from '../server.ts';
import { MCP_SERVER_VERSION } from '../version.ts';
import { type CliOptions, parseArgs, USAGE } from './args.ts';
import { createFileBackend } from './file-backend.ts';

export interface CliIo {
  readonly env: { readonly BUILDR_API_KEY?: string | undefined };
  /** stderr; stdout is reserved for the protocol. */
  readonly log: (line: string) => void;
  /** Writes to stdout (only `--help` / `--version`, never while serving). */
  readonly out: (text: string) => void;
}

interface PayloadMcpModule {
  createPayloadMcpBackend(options: {
    baseUrl: string;
    apiKey: string;
    collection?: string;
    collections?: readonly string[];
    siteUrl?: string;
  }): McpBackend;
}

// The specifier is a variable on purpose: `@buildr/payload` is an optional peer that `@buildr/mcp`
// must not depend on at build time (ADR-024, package-boundaries.md), only resolve at run time.
const PAYLOAD_MCP_SPECIFIER = '@buildr/payload/mcp';

async function loadPayloadBackend(): Promise<PayloadMcpModule | undefined> {
  try {
    return (await import(PAYLOAD_MCP_SPECIFIER)) as PayloadMcpModule;
  } catch {
    return undefined;
  }
}

/** `http://host:3000` -> `http://host:3000/api`; a URL that already ends in `/api` is kept. */
export function apiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

async function createBackend(
  options: CliOptions,
  io: CliIo,
): Promise<{ backend: McpBackend } | { error: string }> {
  if (options.playground !== undefined) {
    try {
      return { backend: createFileBackend({ dir: options.playground, warn: io.log }) };
    } catch (error) {
      return {
        error: `Cannot open the playground directory: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  const apiKey = io.env.BUILDR_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    return { error: 'BUILDR_API_KEY is not set. The API key is only read from the environment.' };
  }
  const payload = await loadPayloadBackend();
  if (!payload) {
    return {
      error:
        'Cannot load @buildr/payload/mcp. Install @buildr/payload next to @buildr/mcp (for example: npm i -g @buildr/mcp @buildr/payload), or use --playground <dir>.',
    };
  }
  const url = options.url as string;
  return {
    backend: payload.createPayloadMcpBackend({
      baseUrl: apiBaseUrl(url),
      apiKey,
      collection: options.authCollection,
      ...(options.collections.length > 0 ? { collections: options.collections } : {}),
      siteUrl: new URL(url).origin,
    }),
  };
}

export interface RunningCli {
  close(): Promise<void>;
}

/**
 * Runs the CLI. Resolves once the server is connected (`RunningCli`), or with the exit code when
 * there is nothing to serve (`--help`, a usage error, a missing key).
 */
export async function runCli(
  argv: readonly string[],
  io: CliIo,
): Promise<RunningCli | { readonly exitCode: number }> {
  const parsed = parseArgs(argv);
  if (parsed.kind === 'help') {
    io.out(USAGE);
    return { exitCode: 0 };
  }
  if (parsed.kind === 'version') {
    io.out(`${MCP_SERVER_VERSION}\n`);
    return { exitCode: 0 };
  }
  if (parsed.kind === 'error') {
    io.log(`buildr-mcp: ${parsed.message}`);
    io.log('Run buildr-mcp --help for usage.');
    return { exitCode: 2 };
  }
  const created = await createBackend(parsed.options, io);
  if ('error' in created) {
    io.log(`buildr-mcp: ${created.error}`);
    return { exitCode: 1 };
  }
  const { server, store } = await createBuildrMcpServerWithTools({
    backend: created.backend,
    options: { allowPublish: parsed.options.allowPublish },
  });
  const sweeper = setInterval(() => store.sweep(), 60_000);
  sweeper.unref();
  const transport = await serveStdio(server);
  io.log(
    `buildr-mcp ${MCP_SERVER_VERSION} ready (${parsed.options.playground === undefined ? parsed.options.url : `playground ${parsed.options.playground}`}${parsed.options.allowPublish ? ', publish enabled' : ''})`,
  );
  return {
    async close() {
      clearInterval(sweeper);
      await transport.close();
    },
  };
}
