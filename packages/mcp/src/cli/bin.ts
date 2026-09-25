#!/usr/bin/env node
import { runCli } from './main.ts';

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

try {
  const result = await runCli(process.argv.slice(2), {
    env: process.env,
    log,
    out: (text) => process.stdout.write(text),
  });
  if ('exitCode' in result) {
    process.exitCode = result.exitCode;
  } else {
    let closing = false;
    const shutdown = (): void => {
      if (closing) return;
      closing = true;
      result
        .close()
        .catch((error: unknown) => log(`buildr-mcp: ${String(error)}`))
        .finally(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    // The client closing our stdin is the normal way a stdio server ends.
    process.stdin.once('end', shutdown);
    process.stdin.once('close', shutdown);
  }
} catch (error) {
  log(`buildr-mcp: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
