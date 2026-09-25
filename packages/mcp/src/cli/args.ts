export interface CliOptions {
  /** The site to talk to (`--url`); mutually exclusive with `playground`. */
  readonly url?: string;
  /** A directory of JSON documents (`--playground`). */
  readonly playground?: string;
  readonly allowPublish: boolean;
  /** The auth collection the API key belongs to (`--auth-collection`, default `users`). */
  readonly authCollection: string;
  /** Builder collections to list when a listing names none (`--collections a,b`). */
  readonly collections: readonly string[];
}

export type ParsedArgs =
  | { readonly kind: 'run'; readonly options: CliOptions }
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'error'; readonly message: string };

export const USAGE = `buildr-mcp: an MCP server (stdio) for building Buildr pages with AI agents

Usage:
  buildr-mcp --url <site>            talk to a site running @buildr/payload (API key in BUILDR_API_KEY)
  buildr-mcp --playground <dir>      work on JSON files in <dir>, no CMS needed

Options:
  --url <site>              site origin, e.g. http://localhost:3000 (the API is <site>/api)
  --playground <dir>        directory of documents; <collection>/<id>.json, or <id>.json for "pages"
  --allow-publish           enable the publish tool (still needs a key that may publish; always confirmed)
  --auth-collection <slug>  auth collection of the API key (default: users)
  --collections <a,b>       builder collections to list when a call names none
  -h, --help                show this help
  -v, --version             show the version

The API key is read from the BUILDR_API_KEY environment variable only. Logs go to stderr; stdout
carries the protocol.
`;

const VALUE_FLAGS = new Set(['--url', '--playground', '--auth-collection', '--collections']);

/** Parses `argv` (without `node` and the script). Never throws. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = new Map<string, string>();
  let allowPublish = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '-h' || arg === '--help') return { kind: 'help' };
    if (arg === '-v' || arg === '--version') return { kind: 'version' };
    if (arg === '--allow-publish') {
      allowPublish = true;
      continue;
    }
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    if (!VALUE_FLAGS.has(flag)) {
      return { kind: 'error', message: `Unknown argument ${JSON.stringify(arg)}.` };
    }
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (value === undefined || value === '' || value.startsWith('--')) {
      return { kind: 'error', message: `${flag} needs a value.` };
    }
    values.set(flag, value);
  }
  const url = values.get('--url');
  const playground = values.get('--playground');
  if (url !== undefined && playground !== undefined) {
    return { kind: 'error', message: 'Use either --url or --playground, not both.' };
  }
  if (url === undefined && playground === undefined) {
    return { kind: 'error', message: 'Pass --url <site> or --playground <dir>.' };
  }
  if (url !== undefined) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    } catch {
      return {
        kind: 'error',
        message: `--url must be an http(s) URL, got ${JSON.stringify(url)}.`,
      };
    }
  }
  return {
    kind: 'run',
    options: {
      ...(url === undefined ? {} : { url }),
      ...(playground === undefined ? {} : { playground }),
      allowPublish,
      authCollection: values.get('--auth-collection') ?? 'users',
      collections: (values.get('--collections') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  };
}
