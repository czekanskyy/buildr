import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type BuilderDocument,
  type ComponentMigrations,
  createEmptyDocument,
  s,
} from '@next-buildr/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { McpBackend } from '../backend.ts';
import { createFileBackend } from '../cli/file-backend.ts';
import { loadDefaultManifest } from '../serialize/default-manifest.test-kit.ts';
import { createSessionStore } from '../session/index.ts';
import { createDocumentTools, templateFragment } from '../tools/documents.ts';
import { createEditingTools } from '../tools/editing.ts';
import { createMemoryBackend } from './memory.ts';

const ref = { collection: 'pages', id: 'old' };
const migrations: ComponentMigrations = {
  'buildr/container': {
    currentVersion: 2,
    steps: [{ from: 1, to: 2, migrate: (props) => ({ ...props, display: s('block') }) }],
  },
};
function stored(version = 1, type = 'buildr/container'): BuilderDocument {
  const blank = createEmptyDocument();
  return {
    ...blank,
    components: { ...blank.components, [type]: version },
    nodes: {
      ...blank.nodes,
      root: { ...blank.nodes['root']!, slots: { default: ['aaaaaaaa01'] } },
      aaaaaaaa01: { id: 'aaaaaaaa01', type, props: { width: s('md') } },
    },
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

for (const kind of ['memory', 'file'] as const) {
  describe(`${kind} backend component migrations`, () => {
    function backend(document: BuilderDocument, componentMigrations?: ComponentMigrations) {
      const options = {
        manifest: loadDefaultManifest(),
        ...(componentMigrations ? { migrations: componentMigrations } : {}),
      };
      if (kind === 'memory')
        return {
          backend: createMemoryBackend({
            ...options,
            documents: [{ ref, title: 'Old', document }],
          }),
        };
      const dir = mkdtempSync(join(tmpdir(), 'buildr-migrations-'));
      dirs.push(dir);
      const file = join(dir, 'old.json');
      writeFileSync(file, JSON.stringify(document));
      return { backend: createFileBackend({ ...options, dir }), file };
    }

    it('loads container@1 read-only without migrations and refuses edits and writes', async () => {
      const original = stored();
      const { backend: subject, file } = backend(original);
      const loaded = await subject.load(ref);
      expect(loaded).toMatchObject({
        ok: true,
        value: {
          document: original,
          readOnly: true,
          readOnlyReasons: [{ code: 'component.version-mismatch' }],
        },
      });
      const store = createSessionStore({ backend: subject });
      const opened = await store.open(ref);
      if (!opened.ok) throw new Error(opened.error.message);
      expect(
        opened.value.apply([{ type: 'node.remove', payload: { ids: ['aaaaaaaa01'] } }]),
      ).toMatchObject({ ok: false, error: { code: 'read-only' } });
      expect(await subject.save(ref, original, 0)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(await subject.publish(ref, 0)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      if (file) expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(original);
      const tool = createDocumentTools({ store }).find((tool) => tool.name === 'open_document')!;
      const result = await tool.handler(ref, { backend: subject });
      expect(JSON.stringify(result)).toContain('component.version-mismatch');
      expect(JSON.stringify(result)).toContain('manifest serves version 2');
    });

    it('migrates container@1 on load and persists the migrated document on save', async () => {
      const original = stored();
      const { backend: subject, file } = backend(original, migrations);
      const loaded = await subject.load(ref);
      if (!loaded.ok) throw new Error(loaded.error.message);
      expect(loaded.value.readOnly).not.toBe(true);
      expect(loaded.value.document.components['buildr/container']).toBe(2);
      expect(loaded.value.document.nodes['aaaaaaaa01']?.props).toEqual({
        width: s('md'),
        display: s('block'),
      });
      expect(original.components['buildr/container']).toBe(1);
      if (file) expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(original);
      expect(await subject.save(ref, loaded.value.document, 0)).toMatchObject({
        ok: true,
        value: { revision: 1 },
      });
      const reloaded = await subject.load(ref);
      expect(reloaded.ok && reloaded.value.document).toEqual(loaded.value.document);
      if (file)
        expect(JSON.parse(readFileSync(file, 'utf8')).document).toEqual(loaded.value.document);
    });

    it('publishes legacy content without persisting migrations from load', async () => {
      const original = stored();
      const { backend: subject, file } = backend(original, migrations);
      const loaded = await subject.load(ref);
      if (!loaded.ok) throw new Error(loaded.error.message);
      expect(loaded.value.document.components['buildr/container']).toBe(2);
      expect(await subject.publish(ref, 0)).toMatchObject({
        ok: true,
        value: { status: 'published', revision: 1 },
      });
      const reloaded = await subject.load(ref);
      expect(reloaded).toMatchObject({
        ok: true,
        value: { status: 'published', revision: 1, document: loaded.value.document },
      });
      if (file) {
        expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
          status: 'published',
          revision: 1,
          document: original,
        });
        const reopened = createFileBackend({
          dir: join(file, '..'),
          manifest: loadDefaultManifest(),
        });
        expect(await reopened.load(ref)).toMatchObject({
          ok: true,
          value: { readOnly: true, revision: 1, document: original },
        });
      }
    });

    it.each([3, 1])(
      'keeps version %i read-only when migrations cannot resolve it',
      async (version) => {
        const { backend: subject } = backend(stored(version), {
          'buildr/container': { currentVersion: 2, steps: [] },
        });
        const loaded = await subject.load(ref);
        expect(loaded).toMatchObject({
          ok: true,
          value: {
            readOnly: true,
            document: stored(version),
            readOnlyReasons: expect.arrayContaining([
              expect.objectContaining({
                code:
                  version === 3
                    ? 'component.newer-than-registry'
                    : 'component.migration-chain-invalid',
              }),
            ]),
          },
        });
      },
    );

    it('keeps unknown types read-only even when migrations are supplied', async () => {
      const { backend: subject } = backend(stored(1, 'custom/retired'), migrations);
      expect(await subject.load(ref)).toMatchObject({
        ok: true,
        value: { readOnly: true, readOnlyReasons: [{ code: 'component.unknown-type' }] },
      });
    });
  });
}

it('pins inserted trees and templates to the current registry versions', async () => {
  const backend: McpBackend = createMemoryBackend({
    manifest: loadDefaultManifest(),
    collections: ['pages'],
  });
  const store = createSessionStore({ backend });
  const created = await store.create({ collection: 'pages', title: 'Current' });
  if (!created.ok) throw new Error(created.error.message);
  const session = created.value;
  expect(templateFragment(session.registry, 'buildr/hero', undefined)).toMatchObject({
    ok: true,
    value: { components: { 'buildr/container': 2 } },
  });
  const insert = createEditingTools({ store }).find((tool) => tool.name === 'insert_nodes')!;
  for (const input of [{ tree: { type: 'buildr/container' } }, { template: 'buildr/hero' }]) {
    const result = await insert.handler({ sessionId: session.id, ...input }, { backend });
    expect(result.isError).not.toBe(true);
    expect(session.doc.components['buildr/container']).toBe(2);
  }
});
