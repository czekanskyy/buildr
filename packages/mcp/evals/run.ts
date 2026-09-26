// The agent-eval harness (evals/README.md). Starts the stdio server, lets a real model build each
// brief through the MCP tools, reopens the saved page and scores it with scorer.ts. Manual or
// nightly; never part of the blocking CI. Without ANTHROPIC_API_KEY it does nothing but say so
// (`--smoke` connects to the server and lists its tools, which needs no key).
//
//   pnpm --filter @next-buildr/mcp eval [--brief <id>]... [--smoke]
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BRIEFS } from './briefs.ts';
import { createModelClient, runAgent, type ToolDefinition } from './model.ts';
import { scoreRun } from './scorer.ts';
import type { OutlineEntry, QualityIssue, RunRecord, Score, ToolCall } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '..');
const bin = join(packageDir, 'src', 'cli', 'bin.ts');

const DEFAULT_MODEL = 'claude-sonnet-5';

/** How the stdio server reaches the documents: a live site (both languages) or a playground folder. */
interface Target {
  readonly args: string[];
  readonly env: Record<string, string>;
  readonly siteLocales: string[];
  readonly label: string;
}

function chooseTarget(env: NodeJS.ProcessEnv): Target {
  const url = env['BUILDR_EVAL_URL'];
  if (url !== undefined && url !== '') {
    const key = env['BUILDR_API_KEY'];
    if (key === undefined || key === '') {
      throw new Error(
        "BUILDR_EVAL_URL is set but BUILDR_API_KEY is not (the agent user's API key).",
      );
    }
    const locales = (env['BUILDR_EVAL_LOCALES'] ?? 'pl,en').split(',').map((part) => part.trim());
    return { args: ['--url', url], env: { BUILDR_API_KEY: key }, siteLocales: locales, label: url };
  }
  const dir = mkdtempSync(join(tmpdir(), 'buildr-eval-'));
  // The playground has one language: the locale rule is left out of the score.
  return { args: ['--playground', dir], env: {}, siteLocales: ['pl'], label: `playground ${dir}` };
}

async function connect(target: Target): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', bin, ...target.args],
    cwd: packageDir,
    env: { ...process.env, ...target.env } as Record<string, string>,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'buildr-agent-eval', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

interface Called {
  readonly isError: boolean;
  readonly text: string;
  readonly data: Record<string, unknown>;
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Called> {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return {
    isError: result.isError === true,
    text: content.map((part) => part.text ?? '').join('\n'),
    data: (result.structuredContent ?? {}) as Record<string, unknown>,
  };
}

/** One brief: a fresh server, the model builds, the harness reopens the page and collects the facts. */
async function runBrief(
  brief: (typeof BRIEFS)[number],
  target: Target,
  modelName: string,
  apiKey: string,
): Promise<{ record: RunRecord; turns: number; final: string }> {
  const client = await connect(target);
  try {
    const tools = (await client.listTools()).tools;
    const definitions: ToolDefinition[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));
    // The build-page prompt is what a user's client would start with: it embeds the guide.
    const prompt = await client.getPrompt({
      name: 'build-page',
      arguments: { brief: brief.prompt, collection: 'pages', title: brief.id },
    });
    const userMessage = prompt.messages
      .map((message) => (message.content.type === 'text' ? message.content.text : ''))
      .join('\n\n');

    const calls: ToolCall[] = [];
    let ref: { collection: string; id: string | number } | undefined;
    const model = await createModelClient(apiKey);
    const ran = await runAgent({
      client: model,
      model: modelName,
      system: 'You are building a web page with the Buildr MCP tools. Follow the instructions.',
      userMessage,
      tools: definitions,
      maxTurns: Number(process.env['BUILDR_EVAL_MAX_TURNS'] ?? 60),
      runTool: async (name, input) => {
        const result = await call(client, name, input);
        calls.push({ name, args: input, isError: result.isError });
        if (name === 'create_document' && !result.isError) {
          ref = result.data['ref'] as typeof ref;
        }
        return { text: result.text, isError: result.isError };
      },
    });

    if (ref === undefined) throw new Error('the agent never created a document');
    // Reopen the saved page from the backend: what was saved is what counts, not the agent's claims.
    const opened = await call(client, 'open_document', { collection: ref.collection, id: ref.id });
    if (opened.isError) throw new Error(`could not reopen the page: ${opened.text}`);
    const sessionId = opened.data['sessionId'] as string;
    const outline = await call(client, 'get_outline', { sessionId, depth: 12, format: 'json' });
    const report = await call(client, 'validate', { sessionId });
    await call(client, 'close_document', { sessionId, discard: true });
    const record: RunRecord = {
      brief,
      siteLocales: target.siteLocales,
      outline: (outline.data['outline'] as { root: OutlineEntry }).root,
      issues: (report.data['issues'] ?? []) as QualityIssue[],
      calls,
    };
    return { record, turns: ran.turns, final: ran.final };
  } finally {
    await client.close();
  }
}

function printScore(score: Score): void {
  console.log(`\n${score.brief}: ${(score.score * 100).toFixed(0)}%`);
  for (const rule of score.rules) {
    const mark = rule.passed === null ? '-' : rule.passed ? 'ok' : 'FAIL';
    console.log(`  ${mark.padEnd(4)} ${rule.rule.padEnd(15)} ${rule.detail}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wanted = argv.flatMap((arg, index) => (arg === '--brief' ? [argv[index + 1]] : []));
  const briefs = wanted.length === 0 ? BRIEFS : BRIEFS.filter((brief) => wanted.includes(brief.id));
  const target = chooseTarget(process.env);

  if (argv.includes('--smoke')) {
    const client = await connect(target);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    await client.close();
    console.log(`connected to the stdio server (${target.label}): ${names.length} tools`);
    return;
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    console.log(
      'ANTHROPIC_API_KEY is not set: nothing to run (harness only). See evals/README.md.',
    );
    return;
  }
  const modelName = process.env['BUILDR_EVAL_MODEL'] ?? DEFAULT_MODEL;
  const scores: Score[] = [];
  for (const brief of briefs) {
    try {
      const { record, turns, final } = await runBrief(brief, target, modelName, apiKey);
      const score = scoreRun(record);
      scores.push(score);
      printScore(score);
      console.log(
        `  ${turns} model turns; last message: ${final.slice(0, 160).replace(/\s+/g, ' ')}`,
      );
    } catch (error) {
      console.log(
        `\n${brief.id}: the run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      scores.push({ brief: brief.id, rules: [], score: 0 });
    }
  }
  const mean = scores.reduce((sum, score) => sum + score.score, 0) / Math.max(scores.length, 1);
  console.log(
    `\nmean score ${(mean * 100).toFixed(0)}% over ${scores.length} brief(s), model ${modelName}`,
  );

  // Tracked over time, never asserted: one JSON report per run and one line in the history.
  const dir = join(here, 'results');
  mkdirSync(dir, { recursive: true });
  const at = new Date().toISOString();
  writeFileSync(
    join(dir, `${at.replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ at, model: modelName, target: target.label, mean, scores }, null, 2),
  );
  appendFileSync(join(dir, 'history.jsonl'), `${JSON.stringify({ at, model: modelName, mean })}\n`);
}

await main();
