// The model side of the harness: a tool-use loop over the Anthropic Messages API. The SDK is loaded
// with a dynamic import so `@buildr/mcp` has no dependency on it (evals/README.md): it is installed
// only by whoever runs the evals, and only this file ever names it. Types are declared locally for
// the few fields used, so the package type-checks without the SDK.

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface Message {
  role: 'user' | 'assistant';
  content: string | Block[];
}

interface Anthropic {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      tools: ToolDefinition[];
      messages: Message[];
    }): Promise<{ content: Block[]; stop_reason: string }>;
  };
}

/** Runs a tool and returns what the model should read. */
export type ToolRunner = (
  name: string,
  input: Record<string, unknown>,
) => Promise<{ readonly text: string; readonly isError: boolean }>;

export interface ModelRun {
  readonly turns: number;
  readonly stopped: 'done' | 'max-turns';
  /** The model's last words (what a user would read). */
  readonly final: string;
}

/** Loads `@anthropic-ai/sdk`, or explains how to get it. */
export async function createModelClient(apiKey: string): Promise<Anthropic> {
  const specifier = '@anthropic-ai/sdk';
  let module: { default: new (options: { apiKey: string }) => Anthropic };
  try {
    module = (await import(specifier)) as typeof module;
  } catch {
    throw new Error(
      'The agent evals need the Anthropic SDK, which @buildr/mcp does not depend on. Install it where you run them: pnpm add -D @anthropic-ai/sdk --filter @buildr/mcp --ignore-workspace-root-check (do not commit the change).',
    );
  }
  return new module.default({ apiKey });
}

const clip = (value: string, max = 20_000): string =>
  value.length > max
    ? `${value.slice(0, max)}\n[cut: ${value.length - max} more characters]`
    : value;

/** Lets the model call tools until it stops asking for them (or `maxTurns` is reached). */
export async function runAgent(options: {
  readonly client: Anthropic;
  readonly model: string;
  readonly system: string;
  readonly userMessage: string;
  readonly tools: readonly ToolDefinition[];
  readonly runTool: ToolRunner;
  readonly maxTurns: number;
}): Promise<ModelRun> {
  const messages: Message[] = [{ role: 'user', content: options.userMessage }];
  let final = '';
  for (let turn = 1; turn <= options.maxTurns; turn++) {
    const reply = await options.client.messages.create({
      model: options.model,
      max_tokens: 8192,
      system: options.system,
      tools: [...options.tools],
      messages,
    });
    messages.push({ role: 'assistant', content: reply.content });
    const uses = reply.content.filter((block) => block.type === 'tool_use');
    final = reply.content
      .filter((block): block is Extract<Block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    if (uses.length === 0) return { turns: turn, stopped: 'done', final };
    const results: Block[] = [];
    for (const use of uses) {
      if (use.type !== 'tool_use') continue;
      const ran = await options.runTool(use.name, use.input);
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: clip(ran.text),
        ...(ran.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
  }
  return { turns: options.maxTurns, stopped: 'max-turns', final };
}
