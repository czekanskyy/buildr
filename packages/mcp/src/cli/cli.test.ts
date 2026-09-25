import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseArgs } from './args.ts';
import { apiBaseUrl, runCli } from './main.ts';

const bin = fileURLToPath(new URL('./bin.ts', import.meta.url));

describe('parseArgs', () => {
  it('needs exactly one of --url and --playground', () => {
    expect(parseArgs([]).kind).toBe('error');
    expect(parseArgs(['--url', 'http://a.test', '--playground', 'x']).kind).toBe('error');
    expect(parseArgs(['--url', 'ftp://a.test']).kind).toBe('error');
  });

  it('reads flags and refuses an API key flag', () => {
    const ok = parseArgs([
      '--url=http://a.test',
      '--allow-publish',
      '--collections',
      'pages, posts',
    ]);
    expect(ok).toMatchObject({
      kind: 'run',
      options: { url: 'http://a.test', allowPublish: true, collections: ['pages', 'posts'] },
    });
    expect(parseArgs(['--url', 'http://a.test', '--api-key', 'secret']).kind).toBe('error');
    expect(parseArgs(['--help']).kind).toBe('help');
  });

  it('derives the API root', () => {
    expect(apiBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000/api');
    expect(apiBaseUrl('http://localhost:3000/api')).toBe('http://localhost:3000/api');
  });
});

describe('runCli', () => {
  it('refuses to start without BUILDR_API_KEY', async () => {
    const logs: string[] = [];
    const result = await runCli(['--url', 'http://localhost:3000'], {
      env: {},
      log: (l) => logs.push(l),
      out: () => {},
    });
    expect(result).toEqual({ exitCode: 1 });
    expect(logs.join('\n')).toContain('BUILDR_API_KEY');
  });
});

describe('buildr-mcp over stdio (playground)', () => {
  const dirs: string[] = [];
  const children: ChildProcessWithoutNullStreams[] = [];
  afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function start(dir: string) {
    const child = spawn(process.execPath, ['--import', 'tsx', bin, '--playground', dir], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: { ...process.env, BUILDR_API_KEY: '' },
    });
    children.push(child);
    let stdout = '';
    let stderr = '';
    const waiting = new Map<number, (message: Record<string, unknown>) => void>();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      let newline = stdout.indexOf('\n');
      while (newline !== -1) {
        const line = stdout.slice(0, newline).trim();
        stdout = stdout.slice(newline + 1);
        if (line) {
          const message = JSON.parse(line) as { id?: number };
          if (message.id !== undefined) waiting.get(message.id)?.(message as never);
        }
        newline = stdout.indexOf('\n');
      }
    });
    let id = 0;
    const request = (method: string, params: unknown = {}) =>
      new Promise<any>((resolve) => {
        id += 1;
        waiting.set(id, resolve);
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    const notify = (method: string) =>
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
    return { child, request, notify, stderr: () => stderr };
  }

  it('initializes, lists tools, calls list_components and saves back to the files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'buildr-mcp-'));
    dirs.push(dir);
    const { child, request, notify, stderr } = start(dir);

    const init = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    expect(init.result.serverInfo.name).toBe('buildr');
    notify('notifications/initialized');

    const tools = await request('tools/list');
    const names = tools.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('list_components');
    expect(names).not.toContain('publish');

    const components = await request('tools/call', { name: 'list_components', arguments: {} });
    expect(components.result.isError).not.toBe(true);
    expect(JSON.stringify(components.result)).toContain('buildr/page');

    const created = await request('tools/call', {
      name: 'create_document',
      arguments: { collection: 'pages', title: 'Hello', slug: 'hello' },
    });
    expect(created.result.isError).not.toBe(true);
    const written = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(written).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, written[0] as string), 'utf8')).title).toBe('Hello');
    expect(stderr()).toContain('ready');

    const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
    child.stdin.end();
    expect(await exited).toBe(0);
  }, 30_000);

  it('loads existing files and skips broken ones with a log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'buildr-mcp-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'broken.json'), '{nope');
    const { request, notify, stderr } = start(dir);
    await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    notify('notifications/initialized');
    const listed = await request('tools/call', { name: 'list_documents', arguments: {} });
    expect(listed.result.isError).not.toBe(true);
    expect(stderr()).toContain('skipping');
  }, 30_000);
});
