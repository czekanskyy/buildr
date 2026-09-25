import type { McpTool } from '../server.ts';

// The tool reference of docs/mcp.md (PB-144) is generated from the registered tool definitions, so
// it cannot drift: `reference.test.ts` fails when the committed block differs and
// `UPDATE_MCP_DOCS=1 pnpm test --filter @buildr/mcp` rewrites it.

const GROUPS: readonly { readonly title: string; readonly tools: readonly string[] }[] = [
  {
    title: 'Discovery (read-only)',
    tools: [
      'list_components',
      'describe_component',
      'list_templates',
      'describe_template',
      'get_style_reference',
      'get_data_schema',
      'list_media',
    ],
  },
  {
    title: 'Documents and sessions',
    tools: [
      'list_documents',
      'create_document',
      'open_document',
      'get_outline',
      'get_node',
      'close_document',
    ],
  },
  {
    title: 'Editing',
    tools: [
      'insert_nodes',
      'update_node',
      'move_nodes',
      'duplicate_nodes',
      'wrap_nodes',
      'unwrap_node',
      'remove_nodes',
      'apply_commands',
      'undo',
      'redo',
    ],
  },
  {
    title: 'Quality, saving and publishing',
    tools: ['validate', 'save', 'publish', 'get_preview_url'],
  },
];

type Schema = Record<string, unknown>;

function isSchema(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeOf(schema: unknown): string {
  if (!isSchema(schema)) return 'any';
  if (typeof schema['$ref'] === 'string') return 'object (a component tree)';
  if (Array.isArray(schema['enum']))
    return schema['enum'].map((v) => `\`${String(v)}\``).join(' \\| ');
  const type = schema['type'];
  const base = Array.isArray(type) ? type.join(' \\| ') : typeof type === 'string' ? type : 'any';
  if (base === 'array') return `array of ${typeOf(schema['items'])}`;
  return base;
}

function cell(text: string): string {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replaceAll('|', '\\|')
    .trim();
}

function annotationsOf(tool: McpTool): string {
  const a = tool.annotations;
  const flags: string[] = [];
  if (a?.readOnlyHint) flags.push('read-only');
  if (a?.destructiveHint) flags.push('destructive');
  if (a?.idempotentHint) flags.push('idempotent');
  return flags.length > 0 ? `*${flags.join(', ')}*\n\n` : '';
}

function renderTool(tool: McpTool): string {
  const properties = isSchema(tool.inputSchema['properties']) ? tool.inputSchema['properties'] : {};
  const required = new Set(
    Array.isArray(tool.inputSchema['required']) ? (tool.inputSchema['required'] as string[]) : [],
  );
  const lines = [`#### \`${tool.name}\``, '', `${annotationsOf(tool)}${tool.description}`, ''];
  const names = Object.keys(properties);
  if (names.length === 0) {
    lines.push('No arguments.', '');
    return lines.join('\n');
  }
  lines.push('| Argument | Type | Required | Description |', '|---|---|---|---|');
  for (const name of names) {
    const schema = properties[name];
    const description =
      isSchema(schema) && typeof schema['description'] === 'string' ? schema['description'] : '';
    lines.push(
      `| \`${name}\` | ${cell(typeOf(schema))} | ${required.has(name) ? 'yes' : 'no'} | ${cell(description)} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/** Markdown for `tools`, grouped; a tool that is in no group lands under "Other". */
export function renderToolReference(tools: readonly McpTool[]): string {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const used = new Set<string>();
  const sections: string[] = [];
  const emit = (title: string, names: readonly string[]): void => {
    const present = names
      .map((name) => byName.get(name))
      .filter((t): t is McpTool => t !== undefined);
    if (present.length === 0) return;
    for (const tool of present) used.add(tool.name);
    sections.push(`### ${title}\n\n${present.map(renderTool).join('\n')}`);
  };
  for (const group of GROUPS) emit(group.title, group.tools);
  emit(
    'Other',
    tools.map((tool) => tool.name).filter((name) => !used.has(name)),
  );
  return sections.join('\n');
}
