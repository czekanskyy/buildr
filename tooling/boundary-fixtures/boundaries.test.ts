import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const configPath = fileURLToPath(new URL('../../.dependency-cruiser.cjs', import.meta.url));
const depcruiseBin = fileURLToPath(
  new URL('../../node_modules/dependency-cruiser/bin/dependency-cruiser.mjs', import.meta.url),
);

interface Violation {
  rule: { name: string };
  from: string;
  to: string;
}

// Cruises one fixture case with the project's real `.dependency-cruiser.cjs` - the same config
// `pnpm check:boundaries` runs - and returns the violations it found.
async function cruise(caseName: string): Promise<Violation[]> {
  const cwd = fileURLToPath(new URL(`cases/${caseName}`, import.meta.url));
  const args = ['--config', configPath, '--output-type', 'json', 'packages'];
  try {
    const { stdout } = await execFileAsync(process.execPath, [depcruiseBin, ...args], { cwd });
    return JSON.parse(stdout).summary.violations;
  } catch (error) {
    // depcruise exits non-zero when it finds violations; stdout still has the report.
    const { stdout } = error as { stdout: string };
    return JSON.parse(stdout).summary.violations;
  }
}

describe('check:boundaries fixtures', () => {
  it('passes a clean, architecture-compliant tree with zero violations', async () => {
    expect(await cruise('clean')).toEqual([]);
  });

  it.each([
    ['core-imports-react', 'core-no-frameworks'],
    ['core-imports-buildr-package', 'core-no-buildr-packages'],
    ['core-immer-outside-commands', 'core-immer-only-in-commands'],
    ['cross-package-internal', 'no-cross-package-internal'],
    ['payload-adapter-imports-payload', 'payload-adapter-isolated'],
    ['circular', 'no-circular'],
    ['core-document-imports-commands', 'core-document-is-self-contained'],
    ['core-commands-imports-protocol', 'core-commands-forbidden'],
    ['next-editor-leaks-outside-subpath', 'next-editor-confined-to-its-subpath'],
    ['react-relative-path-into-next', 'react-no-downstream-packages'],
    ['mcp-imports-react', 'mcp-no-frameworks'],
    ['mcp-imports-payload', 'mcp-no-frameworks'],
    ['mcp-imports-buildr-package', 'mcp-only-core'],
    ['payload-mcp-imports-payload', 'payload-mcp-backend-isolated'],
  ] as const)('%s fails with the %s rule', async (caseName, ruleName) => {
    const violations = await cruise(caseName);
    expect(violations.map((v) => v.rule.name)).toContain(ruleName);
  });
});
