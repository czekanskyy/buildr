// A scripted MCP client (no model): the tool calls an agent would make, written out by hand. It
// talks to the example app over Streamable HTTP as the seeded agent user (e2e/serve.mjs).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const AGENT_API_KEY = 'e2e-agent-key-0123456789';
export const ADMIN = { email: 'e2e@buildr.test', password: 'e2e-password-1' };

export interface Called {
  readonly isError: boolean;
  readonly text: string;
  readonly data: Record<string, unknown>;
}

export interface QualityIssue {
  readonly source: 'validation' | 'a11y';
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly locale?: string;
}

export interface Report {
  readonly ok: boolean;
  readonly counts: { readonly error: number; readonly warning: number; readonly info: number };
  readonly issues: readonly QualityIssue[];
}

/** One agent: a connected client plus helpers that fail loudly when a tool reports an error. */
export class Agent {
  private readonly client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  static async connect(baseURL: string): Promise<Agent> {
    const transport = new StreamableHTTPClientTransport(new URL('/api/buildr/mcp', baseURL), {
      requestInit: { headers: { authorization: `users API-Key ${AGENT_API_KEY}` } },
    });
    const client = new Client({ name: 'e2e-scripted-agent', version: '0.0.0' });
    await client.connect(transport as Parameters<Client['connect']>[0]);
    return new Agent(client);
  }

  close(): Promise<void> {
    return this.client.close();
  }

  /** Calls a tool and returns its result, whether or not it is an error. */
  async try(name: string, args: Record<string, unknown> = {}): Promise<Called> {
    const result = await this.client.callTool({ name, arguments: args });
    const content = (result.content ?? []) as { type: string; text?: string }[];
    return {
      isError: result.isError === true,
      text: content.map((part) => part.text ?? '').join('\n'),
      data: (result.structuredContent ?? {}) as Record<string, unknown>,
    };
  }

  /** Calls a tool that must succeed. */
  async call(name: string, args: Record<string, unknown> = {}): Promise<Called> {
    const result = await this.try(name, args);
    if (result.isError) throw new Error(`${name} failed: ${result.text}`);
    return result;
  }

  async validate(sessionId: string): Promise<Report> {
    return (await this.call('validate', { sessionId })).data as unknown as Report;
  }

  /** Saves the draft and returns where a person can look at it. */
  async save(sessionId: string): Promise<{ revision: number; previewUrl: string | null }> {
    const saved = await this.call('save', { sessionId });
    if (saved.data['saved'] !== true) throw new Error(`save did not save: ${saved.text}`);
    const preview = await this.call('get_preview_url', { sessionId });
    return {
      revision: saved.data['revision'] as number,
      previewUrl: (preview.data['url'] as string | null | undefined) ?? null,
    };
  }
}

/** A tree node in the agent format. */
export interface Tree {
  type: string;
  props?: Record<string, unknown>;
  children?: Tree[];
}
