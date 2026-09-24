import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BuilderDocument, NodeId, PageNode } from '../document/types.ts';
import { createSeededIdGenerator } from '../ids/seeded-id-generator.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { createRegistryMeta } from '../registry/registry.ts';
import { err, ok } from '../result/result.ts';
import { applyDocumentPatches } from './apply-patches.ts';
import { commandError, fromReason } from './errors.ts';
import { canExecute, execute, executeBatch } from './execute.ts';
import { checkPayload, commandSchema, createCommandRegistry, parseCommand } from './registry.ts';
import { replay } from './replay.ts';
import type { Command, CommandEnv, CommandHandler } from './types.ts';

function meta(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
    label: type,
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

const registry = createRegistryMeta({
  components: [
    meta('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    meta('buildr/box', { slots: { default: {} } }),
  ],
});

type Rename = Command<'test.rename', { id: string; name: string }>;

const noop: CommandHandler = {
  type: 'test.noop',
  validate: () => ok(undefined),
  apply: () => ({ affected: [] }),
};

const rename: CommandHandler<Rename> = {
  type: 'test.rename',
  validate(doc, cmd) {
    return doc.nodes[cmd.payload.id] === undefined
      ? err(commandError('command.not-found', `no node ${cmd.payload.id}`))
      : ok(undefined);
  },
  apply(draft, cmd) {
    const node = draft.nodes[cmd.payload.id];
    if (node) node.name = cmd.payload.name;
    return { affected: [cmd.payload.id, cmd.payload.id], select: [cmd.payload.id] };
  },
};

const fail: CommandHandler = {
  type: 'test.fail',
  validate: () => err(fromReason({ code: 'locked-structure', message: 'This section is locked.' })),
  apply: () => {
    throw new Error('apply must not run after a failed validate');
  },
};

/** A buggy handler: leaves a dangling child reference behind. */
const corrupt: CommandHandler = {
  type: 'test.corrupt',
  validate: () => ok(undefined),
  apply(draft) {
    const root = draft.nodes[draft.root];
    if (root) root.slots = { default: ['ghost'] };
    return { affected: [draft.root] };
  },
};

const commands = createCommandRegistry([noop, rename, fail, corrupt]);
const env: CommandEnv = { registry, commands, generateId: createSeededIdGenerator(1) };

function smallDoc(): BuilderDocument {
  const node = (id: string): PageNode => ({ id, type: 'buildr/box' });
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['a', 'b'] } },
      a: node('a'),
      b: node('b'),
    },
    components: { 'buildr/page': 1, 'buildr/box': 1 },
  };
}

const rn = (id: string, name: string): Rename => ({ type: 'test.rename', payload: { id, name } });
const snapshot = (doc: BuilderDocument) => JSON.stringify(doc);

describe('execute', () => {
  it('applies a command and reports patches, inverse, affected and selection', () => {
    const doc = smallDoc();
    const result = execute(doc, rn('a', 'Hero'), env);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.doc.nodes.a?.name).toBe('Hero');
    expect(result.value.patches).toEqual([
      { op: 'add', path: ['nodes', 'a', 'name'], value: 'Hero' },
    ]);
    expect(result.value.inverse).toEqual([{ op: 'remove', path: ['nodes', 'a', 'name'] }]);
    expect(result.value.affected).toEqual(['a']);
    expect(result.value.select).toEqual(['a']);
  });

  it('never mutates its input and shares untouched subtrees', () => {
    const doc = smallDoc();
    const before = snapshot(doc);
    const result = execute(doc, rn('a', 'Hero'), env);
    if (!result.ok) throw new Error('unexpected');
    expect(snapshot(doc)).toBe(before);
    expect(result.value.doc.nodes.b).toBe(doc.nodes.b);
    expect(result.value.doc.nodes.root).toBe(doc.nodes.root);
  });

  it('a command that changes nothing returns the same document and no patches', () => {
    const doc = smallDoc();
    const result = execute(doc, { type: 'test.noop', payload: null }, env);
    if (!result.ok) throw new Error('unexpected');
    expect(result.value.doc).toBe(doc);
    expect(result.value.patches).toEqual([]);
  });

  it('a rejected command is an Err carrying the rule message and leaves the document alone', () => {
    const doc = smallDoc();
    const before = snapshot(doc);
    const result = execute(doc, { type: 'test.fail', payload: null }, env);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'command.rejected', message: 'This section is locked.' },
    });
    expect(snapshot(doc)).toBe(before);
  });

  it('reports an unknown type and never throws on a bad command', () => {
    expect(execute(smallDoc(), { type: 'nope', payload: 1 }, env)).toMatchObject({
      ok: false,
      error: { code: 'command.unknown-type' },
    });
    expect(execute(smallDoc(), rn('missing', 'x'), env)).toMatchObject({
      ok: false,
      error: { code: 'command.not-found' },
    });
  });

  it('rejects a handler that leaves the document invalid (dev-mode invariant check)', () => {
    const result = execute(smallDoc(), { type: 'test.corrupt', payload: null }, env);
    expect(result).toMatchObject({ ok: false, error: { code: 'command.invariant-violated' } });
    if (!result.ok) expect(result.error.diagnostics?.length).toBeGreaterThan(0);
  });

  it('skips the invariant check when it is switched off', () => {
    const result = execute(
      smallDoc(),
      { type: 'test.corrupt', payload: null },
      { ...env, checkInvariants: false },
    );
    expect(result.ok).toBe(true);
  });

  it('canExecute validates without running', () => {
    const doc = smallDoc();
    expect(canExecute(doc, rn('a', 'x'), env).ok).toBe(true);
    expect(canExecute(doc, rn('zzz', 'x'), env).ok).toBe(false);
    expect(canExecute(doc, { type: 'test.fail', payload: null }, env).ok).toBe(false);
  });
});

describe('executeBatch', () => {
  it('runs each command against the previous result and returns one entry', () => {
    const result = executeBatch(smallDoc(), [rn('a', 'One'), rn('a', 'Two'), rn('b', 'B')], env);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.doc.nodes.a?.name).toBe('Two');
    expect(result.value.doc.nodes.b?.name).toBe('B');
    expect(result.value.affected).toEqual(['a', 'b']);
    expect(result.value.select).toEqual(['b']);
  });

  it('is atomic: a failure anywhere returns Err with the position and no partial result', () => {
    const doc = smallDoc();
    const before = snapshot(doc);
    const result = executeBatch(doc, [rn('a', 'One'), rn('missing', 'x'), rn('b', 'B')], env);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'command.not-found', commandIndex: 1 },
    });
    expect(snapshot(doc)).toBe(before);
  });

  it('one inverse undoes the whole batch, and patches redo it', () => {
    const doc = smallDoc();
    const result = executeBatch(doc, [rn('a', 'One'), rn('a', 'Two'), rn('b', 'B')], env);
    if (!result.ok) throw new Error('unexpected');
    const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
    expect(undone.ok && undone.value).toEqual(doc);
    const redone = applyDocumentPatches(doc, result.value.patches);
    expect(redone.ok && redone.value).toEqual(result.value.doc);
  });

  it('an empty batch is a no-op', () => {
    const doc = smallDoc();
    const result = executeBatch(doc, [], env);
    expect(result.ok && result.value.doc).toBe(doc);
  });
});

describe('undo . do = id (property)', () => {
  it('inverse restores the document and patches replay it, for random command sequences', () => {
    const command = fc.record({
      id: fc.constantFrom('a', 'b', 'root'),
      name: fc.string({ maxLength: 8 }),
    });
    fc.assert(
      fc.property(fc.array(command, { minLength: 1, maxLength: 8 }), (list) => {
        const doc = smallDoc();
        const result = executeBatch(
          doc,
          list.map((c) => rn(c.id, c.name)),
          env,
        );
        if (!result.ok) throw new Error(result.error.message);
        const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
        expect(undone.ok && undone.value).toEqual(doc);
        const redone = applyDocumentPatches(doc, result.value.patches);
        expect(redone.ok && redone.value).toEqual(result.value.doc);
      }),
    );
  });
});

describe('replay', () => {
  it('re-runs a log and matches a batch', () => {
    const log = [rn('a', 'One'), rn('b', 'Two')];
    const replayed = replay(smallDoc(), log, env);
    const batched = executeBatch(smallDoc(), log, env);
    if (!replayed.ok || !batched.ok) throw new Error('unexpected');
    expect(replayed.value.doc).toEqual(batched.value.doc);
    expect(replayed.value.steps).toHaveLength(2);
  });

  it('stops at the first failure and says where', () => {
    const result = replay(smallDoc(), [rn('a', 'One'), rn('nope', 'x'), rn('b', 'Two')], env);
    expect(result).toMatchObject({ ok: false, error: { commandIndex: 1 } });
  });
});

describe('command registry and parsing', () => {
  it('rejects two handlers for one type and lists the types sorted', () => {
    expect(() => createCommandRegistry([noop, noop])).toThrow(/duplicate handler for "test.noop"/);
    expect(commands.types).toEqual(['test.corrupt', 'test.fail', 'test.noop', 'test.rename']);
  });

  it('validates the payload with the handler schema before validate/apply', async () => {
    const { z } = await import('zod');
    const strict: CommandHandler<Rename> = {
      ...rename,
      schema: z.strictObject({ id: z.string(), name: z.string().max(5) }),
    };
    const local = createCommandRegistry([strict]);
    const localEnv = { ...env, commands: local };
    expect(execute(smallDoc(), rn('a', 'too long name'), localEnv)).toMatchObject({
      ok: false,
      error: { code: 'command.invalid-payload' },
    });
    expect(execute(smallDoc(), { type: 'test.rename', payload: 5 }, localEnv).ok).toBe(false);
    expect(execute(smallDoc(), rn('a', 'ok'), localEnv).ok).toBe(true);
    expect(checkPayload(local, rn('a', 'ok')).ok).toBe(true);
  });

  it('parseCommand accepts a well-formed command and rejects everything else', () => {
    expect(parseCommand(commands, rn('a', 'x'))).toEqual(ok(rn('a', 'x')));
    for (const bad of [null, 5, 'x', [], {}, { type: '' }, { type: 'x', payload: 1, extra: 1 }]) {
      expect(parseCommand(commands, bad)).toMatchObject({
        ok: false,
        error: { code: 'command.invalid-command' },
      });
    }
    expect(parseCommand(commands, { type: 'nope', payload: 1 })).toMatchObject({
      ok: false,
      error: { code: 'command.unknown-type' },
    });
    expect(commandSchema.safeParse({ type: 'x'.repeat(65), payload: 1 }).success).toBe(false);
  });
});

describe('applyDocumentPatches', () => {
  it('rejects malformed patches, forbidden path segments and patches that do not fit', () => {
    const doc = smallDoc();
    const invalid = { ok: false, error: { code: 'command.invalid-patches' } };
    const bad: unknown[][] = [
      [{ op: 'move', path: ['nodes'] }],
      [{ op: 'add', path: ['nodes', '__proto__', 'x'], value: 1 }],
      [{ op: 'add', path: ['constructor', 'prototype', 'x'], value: 1 }],
      [{ op: 'add', path: [{}], value: 1 }],
      [{ op: 'add', path: ['nodes'], value: 1, extra: true }],
      [null],
      [{ op: 'replace', path: ['nodes', 'missing', 'name'], value: 'x' }],
    ];
    for (const patches of bad) expect(applyDocumentPatches(doc, patches)).toMatchObject(invalid);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(applyDocumentPatches(doc, 'nope' as never)).toMatchObject(invalid);
  });

  it('does not mutate its input', () => {
    const doc = smallDoc();
    const before = snapshot(doc);
    applyDocumentPatches(doc, [{ op: 'add', path: ['nodes', 'a', 'name'], value: 'x' }]);
    expect(snapshot(doc)).toBe(before);
  });
});

describe('performance', () => {
  function bigDoc(count: number): BuilderDocument {
    const nodes: Record<NodeId, PageNode> = {};
    const groups = 50;
    const perGroup = Math.ceil(count / groups);
    const rootChildren: string[] = [];
    let n = 0;
    for (let g = 0; g < groups; g++) {
      const id = `g${g}`;
      const children: string[] = [];
      for (let i = 0; i < perGroup && n < count; i++, n++) {
        const childId = `n${n}`;
        nodes[childId] = { id: childId, type: 'buildr/box' };
        children.push(childId);
      }
      nodes[id] = { id, type: 'buildr/box', slots: { default: children } };
      rootChildren.push(id);
    }
    nodes.root = { id: 'root', type: 'buildr/page', slots: { default: rootChildren } };
    return {
      schemaVersion: 1,
      root: 'root',
      nodes,
      components: { 'buildr/page': 1, 'buildr/box': 1 },
    };
  }

  function averageMs(doc: BuilderDocument, options: Partial<CommandEnv>, runs: number): number {
    let current = doc;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      const result = execute(current, rn(`n${i}`, `name ${i}`), { ...env, ...options });
      if (!result.ok) throw new Error(result.error.message);
      current = result.value.doc;
    }
    return (performance.now() - start) / runs;
  }

  // The budget is 5ms (about 2.5ms when idle, dominated by Immer copying the 5000-entry `nodes`
  // map); the assertion allows 4x so a CI machine running other packages' tests beside it does not fail it.
  it('runs a command within budget at 5000 nodes (invariant check off, as in production)', () => {
    const doc = bigDoc(5000);
    averageMs(doc, { checkInvariants: false }, 5); // warm-up, includes Immer's one-time freeze
    // Best of several batches, so a busy CI machine does not fail a run that is fast when idle.
    const best = Math.min(
      ...Array.from({ length: 5 }, () => averageMs(doc, { checkInvariants: false }, 10)),
    );
    expect(best).toBeLessThan(20);
  });

  it('stays usable with the dev-mode invariant check on', () => {
    const doc = bigDoc(5000);
    averageMs(doc, {}, 3);
    const best = Math.min(...Array.from({ length: 3 }, () => averageMs(doc, {}, 10)));
    expect(best).toBeLessThan(100);
  });
});
