import { createEmptyDocument, type NodeId, ok } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { describe, expect, it } from 'vitest';
import { createTestManifest } from '../testing/index.ts';
import { createEditSession, type EditSession, MAX_COMMANDS_PER_BATCH } from './session.ts';

function nodeIdGenerator(): () => string {
  let n = 0;
  return () => `n${String(++n).padStart(9, '0')}`;
}

function makeSession(
  overrides: { maxNodes?: number; maxBytes?: number; readOnly?: boolean } = {},
): EditSession {
  const created = createEditSession({
    id: 's_test',
    ref: { collection: 'pages', id: '1' },
    userId: 'u1',
    revision: 3,
    layoutSource: 'document',
    layoutRef: 'pages:1',
    contextRef: 'pages:1',
    previewPath: null,
    document: createEmptyDocument(),
    readOnly: overrides.readOnly ?? false,
    manifest: createTestManifest(),
    limits: { maxNodes: overrides.maxNodes ?? 5000, maxBytes: overrides.maxBytes ?? 2_000_000 },
    canUnlockTemplates: false,
    clock: () => 0,
    generateId: nodeIdGenerator(),
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

let fragmentCounter = 0;
function insertHeading(text = 'Hello', parentId = 'root'): Command {
  const id = `f${String(++fragmentCounter).padStart(9, '0')}`;
  return {
    type: 'node.insert',
    payload: {
      parentId,
      slot: 'default',
      index: 0,
      fragment: {
        format: 'buildr/fragment',
        schemaVersion: 1,
        components: { 'buildr/heading': 1 },
        roots: [id],
        nodes: {
          [id]: { id, type: 'buildr/heading', props: { text: { kind: 'static', value: text } } },
        },
      },
    },
  };
}

function firstHeading(session: EditSession): NodeId {
  const id = Object.keys(session.doc.nodes).find((k) => k !== 'root');
  if (id === undefined) throw new Error('no node');
  return id;
}

describe('EditSession', () => {
  it('applies a batch as one undo step and reports what changed', () => {
    const session = makeSession();
    const result = session.apply([insertHeading('A'), insertHeading('B')], {
      label: 'two headings',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(session.doc.nodes)).toHaveLength(3);
    expect(result.value.affected.length).toBeGreaterThan(0);
    expect(result.value.dirty).toBe(true);
    expect(session.history.past).toHaveLength(1);
    expect(session.history.past[0]?.label).toBe('two headings');
  });

  it('is atomic: a failing command leaves document and history untouched', () => {
    const session = makeSession();
    const before = session.doc;
    const result = session.apply([
      insertHeading('A'),
      {
        type: 'node.setProp',
        payload: { id: 'missing', prop: 'text', value: { kind: 'static', value: 'x' } },
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('command-rejected');
    expect(result.error.command?.commandIndex).toBe(1);
    expect(session.doc).toBe(before);
    expect(session.history.past).toHaveLength(0);
    expect(session.dirty).toBe(false);
  });

  it('rejects unknown command types and oversized batches without changing anything', () => {
    const session = makeSession();
    const before = session.doc;
    const unknown = session.apply([{ type: 'node.explode', payload: {} }]);
    expect(unknown.ok).toBe(false);
    const big = session.apply(
      Array.from({ length: MAX_COMMANDS_PER_BATCH + 1 }, () => insertHeading()),
    );
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error.code).toBe('limit-exceeded');
    expect(session.doc).toBe(before);
  });

  it('an empty batch is a no-op', () => {
    const session = makeSession();
    const result = session.apply([]);
    expect(result).toEqual(ok(expect.objectContaining({ dirty: false })));
  });

  it('undoes and redoes, and derives dirty from the history cursor', () => {
    const session = makeSession();
    const initial = session.doc;
    session.apply([insertHeading('A')]);
    const afterInsert = session.doc;
    expect(session.dirty).toBe(true);

    const undone = session.undo();
    expect(undone.ok).toBe(true);
    expect(session.doc).toEqual(initial);
    expect(session.dirty).toBe(false);
    expect(session.canRedo).toBe(true);

    const redone = session.redo();
    expect(redone.ok).toBe(true);
    expect(session.doc).toEqual(afterInsert);
    expect(session.dirty).toBe(true);
  });

  it('reports nothing to undo / redo', () => {
    const session = makeSession();
    const undo = session.undo();
    const redo = session.redo();
    expect(!undo.ok && undo.error.code).toBe('nothing-to-undo');
    expect(!redo.ok && redo.error.code).toBe('nothing-to-redo');
  });

  it('markSaved makes the current state clean and moves the base revision; undo after it is dirty', () => {
    const session = makeSession();
    session.apply([insertHeading('A')]);
    session.markSaved({ revision: 4 });
    expect(session.revision).toBe(4);
    expect(session.dirty).toBe(false);
    session.undo();
    expect(session.dirty).toBe(true);
    session.redo();
    expect(session.dirty).toBe(false);
  });

  it('a new change after undo clears redo', () => {
    const session = makeSession();
    session.apply([insertHeading('A')]);
    session.undo();
    session.apply([insertHeading('B')]);
    expect(session.canRedo).toBe(false);
  });

  it('never lets the document be mutated outside a command (frozen)', () => {
    const session = makeSession();
    session.apply([insertHeading('A')]);
    const id = firstHeading(session);
    const doc = session.doc as { nodes: Record<string, { props?: Record<string, unknown> }> };
    expect(Object.isFrozen(session.doc)).toBe(true);
    expect(() => {
      doc.nodes[id]!.props = {};
    }).toThrow(TypeError);
    expect(() => {
      doc.nodes.injected = { props: {} };
    }).toThrow(TypeError);
    session.undo();
    expect(Object.isFrozen(session.doc)).toBe(true);
  });

  it('refuses changes that grow a document past the node limit, but still allows removal', () => {
    const session = makeSession({ maxNodes: 3 });
    expect(session.apply([insertHeading('A'), insertHeading('B')]).ok).toBe(true);
    const before = session.doc;
    const over = session.apply([insertHeading('C')]);
    expect(!over.ok && over.error.code).toBe('limit-exceeded');
    expect(session.doc).toBe(before);
    const remove = session.apply([
      { type: 'node.remove', payload: { ids: [firstHeading(session)] } },
    ]);
    expect(remove.ok).toBe(true);
  });

  it('refuses changes that grow a document past the byte limit', () => {
    const session = makeSession({ maxBytes: 400 });
    const before = session.doc;
    const over = session.apply([insertHeading('x'.repeat(500))]);
    expect(!over.ok && over.error.code).toBe('limit-exceeded');
    expect(session.doc).toBe(before);
    expect(session.history.past).toHaveLength(0);
  });

  it('a read-only session refuses to apply', () => {
    const session = makeSession({ readOnly: true });
    const result = session.apply([insertHeading()]);
    expect(!result.ok && result.error.code).toBe('read-only');
  });

  it('property: undo . do = id and undoing everything restores the loaded document', () => {
    // Deterministic PRNG (mulberry32); fast-check lives in core only and is not a dependency here.
    for (let seed = 1; seed <= 60; seed++) {
      let state = seed * 2654435761;
      const rand = (n: number): number => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
      };
      const session = makeSession();
      const initial = session.doc;
      let steps = 0;
      for (let i = 0; i < 12; i++) {
        const nodes = Object.keys(session.doc.nodes).filter((k) => k !== 'root');
        const pick = nodes[rand(Math.max(nodes.length, 1))];
        const before = session.doc;
        const kind = rand(4);
        let commands: Command[];
        if (kind === 0 || pick === undefined) commands = [insertHeading(`t${rand(100)}`)];
        else if (kind === 1) {
          commands = [
            {
              type: 'node.setProp',
              payload: {
                id: pick,
                prop: 'text',
                value: { kind: 'static', value: `v${rand(100)}` },
              },
            },
          ];
        } else if (kind === 2) commands = [{ type: 'node.remove', payload: { ids: [pick] } }];
        else commands = [insertHeading('a'), insertHeading('b')];
        const result = session.apply(commands);
        if (!result.ok) {
          expect(session.doc).toBe(before);
          continue;
        }
        steps++;
        const after = session.doc;
        expect(session.undo().ok).toBe(true);
        expect(session.doc).toEqual(before);
        expect(session.redo().ok).toBe(true);
        expect(session.doc).toEqual(after);
      }
      for (let i = 0; i < steps; i++) expect(session.undo().ok).toBe(true);
      expect(session.doc).toEqual(initial);
      expect(session.dirty).toBe(false);
    }
  });
});
