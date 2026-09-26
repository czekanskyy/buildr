import { readFileSync } from 'node:fs';
import {
  createRegistryMeta,
  fromManifest,
  type RegistryManifest,
  type RegistryMeta,
} from '@next-buildr/core';

// The built-in component catalogue for tests. `@next-buildr/mcp` may not depend on `@next-buildr/components`
// (ADR-024), so the manifest is a committed JSON fixture that a test in `@next-buildr/components`
// keeps current (`UPDATE_MCP_FIXTURE=1 pnpm test --filter @next-buildr/components`).
const fixture = new URL('../../fixtures/default-manifest.json', import.meta.url);

export function loadDefaultManifest(): RegistryManifest {
  const parsed = fromManifest(JSON.parse(readFileSync(fixture, 'utf8')));
  if (!parsed.ok) throw new Error(`default-manifest.json is invalid: ${parsed.error[0]?.message}`);
  return parsed.value;
}

export function loadDefaultRegistry(): RegistryMeta {
  const manifest = loadDefaultManifest();
  return createRegistryMeta({
    components: Object.values(manifest.components),
    templates: Object.values(manifest.templates),
  });
}
