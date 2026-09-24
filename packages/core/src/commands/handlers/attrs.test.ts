import { describe, expect, it } from 'vitest';
import { bind, expr, s } from '../../values/helpers.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import type { CommandEnv, UnlockRequest } from '../types.ts';
import { MAX_NAME_LENGTH, setAttrHandler } from './attrs.ts';
import { buildDoc, cmd, env, ID, node, snapshot } from './handlers.test-kit.ts';

const [S, A, B, X] = [ID(1), ID(2), ID(3), ID(4)];

const text = (id: string, extra = {}) => node(id, 'buildr/text', undefined, extra);
// root -> S -> [A, B]
const doc = (aExtra = {}, sExtra = {}) =>
  buildDoc(
    [node(S, 'buildr/section', [A, B], sExtra), text(A, aExtra), text(B, { anchor: 'taken' })],
    [S],
  );

const setAttr = (id: string, key: string, value: unknown) =>
  cmd('node.setAttr', { id, key, value });

type Doc = ReturnType<typeof doc>;

function run(d: Doc, command: ReturnType<typeof setAttr>, e: CommandEnv = env) {
  const result = execute(d, command, e);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function rejected(d: Doc, command: Parameters<typeof execute>[1], e: CommandEnv = env) {
  const before = snapshot(d);
  const result = execute(d, command, e);
  expect(snapshot(d)).toBe(before);
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

const withUnlock = (allow: boolean, seen: UnlockRequest[] = []): CommandEnv => ({
  ...env,
  canUnlock: (request) => {
    seen.push(request);
    return allow;
  },
});

describe('node.setAttr name / anchor / region', () => {
  it('sets, replaces and removes a name', () => {
    const set = run(doc(), setAttr(A, 'name', 'Hero'));
    expect(set.doc.nodes[A]?.name).toBe('Hero');
    expect(set.affected).toEqual([A]);
    expect(run(set.doc, setAttr(A, 'name', null)).doc.nodes[A]).not.toHaveProperty('name');
    expect(run(set.doc, setAttr(A, 'name', '')).doc.nodes[A]).not.toHaveProperty('name');
  });

  it('a name may be renamed on the root and is limited to 80 characters', () => {
    expect(run(doc(), setAttr('root', 'name', 'Home')).doc.nodes.root?.name).toBe('Home');
    run(doc(), setAttr(A, 'name', 'x'.repeat(MAX_NAME_LENGTH)));
    expect(rejected(doc(), setAttr(A, 'name', 'x'.repeat(MAX_NAME_LENGTH + 1))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setAttr(A, 'name', 5)).code).toBe('command.invalid-value');
  });

  it('sets and removes an anchor', () => {
    const set = run(doc(), setAttr(A, 'anchor', 'about-us'));
    expect(set.doc.nodes[A]?.anchor).toBe('about-us');
    expect(run(set.doc, setAttr(A, 'anchor', null)).doc.nodes[A]).not.toHaveProperty('anchor');
  });

  it('rejects an anchor that is malformed or already used, but allows keeping its own', () => {
    for (const bad of ['', 'About', '1abc', 'a b', 'a_b', 'x'.repeat(65), 5, '__proto__']) {
      expect(rejected(doc(), setAttr(A, 'anchor', bad)).code).toBe('command.invalid-value');
    }
    expect(rejected(doc(), setAttr(A, 'anchor', 'taken')).code).toBe('command.duplicate-anchor');
    const same = run(doc(), setAttr(B, 'anchor', 'taken'));
    expect(same.patches).toEqual([]);
  });

  it('sets a region name and removes it (outside a locked subtree no permission is needed)', () => {
    const set = run(doc(), setAttr(A, 'region', 'actions'));
    expect(set.doc.nodes[A]?.region).toBe('actions');
    expect(run(set.doc, setAttr(A, 'region', null)).doc.nodes[A]).not.toHaveProperty('region');
    expect(rejected(doc(), setAttr(A, 'region', 'no spaces')).code).toBe('command.invalid-value');
  });

  it('the root has only a name', () => {
    expect(rejected(doc(), setAttr('root', 'anchor', 'x')).code).toBe('command.invalid-attr');
    expect(rejected(doc(), setAttr('root', 'lock', { content: true })).code).toBe(
      'command.invalid-attr',
    );
  });
});

describe('node.setAttr visibleIf', () => {
  it('accepts a binding and an expression, and removes it', () => {
    const bound = run(doc(), setAttr(A, 'visibleIf', bind('post.published')));
    expect(bound.doc.nodes[A]?.visibleIf).toEqual(bind('post.published'));
    const formula = run(doc(), setAttr(A, 'visibleIf', expr('count > 0')));
    expect(formula.doc.nodes[A]?.visibleIf).toEqual(expr('count > 0'));
    expect(run(bound.doc, setAttr(A, 'visibleIf', null)).doc.nodes[A]).not.toHaveProperty(
      'visibleIf',
    );
  });

  it('rejects a fixed value, a malformed binding or expression, translations and junk', () => {
    expect(rejected(doc(), setAttr(A, 'visibleIf', s(true))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setAttr(A, 'visibleIf', bind('a..b'))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setAttr(A, 'visibleIf', expr('1 +'))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setAttr(A, 'visibleIf', expr('{{ x', { mode: 'template' }))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setAttr(A, 'visibleIf', 'yes')).code).toBe('command.invalid-value');
    expect(rejected(doc(), setAttr(A, 'visibleIf', { kind: 'nope' })).code).toBe(
      'command.invalid-value',
    );
  });

  it('respects content locks (also for anchors), but a name is always editable', () => {
    const locked = doc({ lock: { content: true } });
    expect(rejected(locked, setAttr(A, 'visibleIf', bind('a.b'))).reason?.code).toBe(
      'locked-content',
    );
    expect(rejected(locked, setAttr(A, 'anchor', 'x')).reason?.code).toBe('locked-content');
    expect(run(locked, setAttr(A, 'name', 'Renamed')).doc.nodes[A]?.name).toBe('Renamed');
  });
});

describe('node.setAttr lock', () => {
  it('adding a lock needs no permission, and an empty lock removes the key', () => {
    const locked = run(
      doc(),
      setAttr(A, 'lock', { structure: true, content: true }),
      withUnlock(false),
    ).doc;
    expect(locked.nodes[A]?.lock).toEqual({ structure: true, content: true });
    const widened = run(
      locked,
      setAttr(A, 'lock', { structure: true, content: true, style: true }),
      withUnlock(false),
    );
    expect(widened.doc.nodes[A]?.lock).toEqual({ structure: true, content: true, style: true });
  });

  it('removing a lock asks the host, naming the aspects that would be unlocked', () => {
    const start = doc({ lock: { structure: true, content: true } });
    const seen: UnlockRequest[] = [];
    const next = run(start, setAttr(A, 'lock', { structure: true }), withUnlock(true, seen)).doc;
    expect(next.nodes[A]?.lock).toEqual({ structure: true });
    expect(seen).toEqual([{ nodeId: A, aspects: ['content'] }]);
    const cleared = run(start, setAttr(A, 'lock', null), withUnlock(true)).doc;
    expect(cleared.nodes[A]).not.toHaveProperty('lock');
    expect(run(start, setAttr(A, 'lock', {}), withUnlock(true)).doc.nodes[A]).not.toHaveProperty(
      'lock',
    );
  });

  it('without permission — or without any canUnlock — removing a lock is refused', () => {
    const start = doc({ lock: { structure: true } });
    expect(rejected(start, setAttr(A, 'lock', null), withUnlock(false)).code).toBe(
      'command.unlock-not-permitted',
    );
    expect(rejected(start, setAttr(A, 'lock', null)).code).toBe('command.unlock-not-permitted');
    expect(rejected(start, setAttr(A, 'lock', { content: true }), withUnlock(false)).code).toBe(
      'command.unlock-not-permitted',
    );
  });

  it('rejects malformed locks', () => {
    for (const bad of [
      true,
      'structure',
      { structure: false },
      { other: true },
      [],
      { structure: 1 },
    ]) {
      expect(rejected(doc(), setAttr(A, 'lock', bad)).code).toBe('command.invalid-value');
    }
  });

  it('changing a region inside a structurally locked subtree also needs permission', () => {
    const locked = doc({}, { lock: { structure: true } });
    expect(rejected(locked, setAttr(A, 'region', 'actions')).code).toBe(
      'command.unlock-not-permitted',
    );
    expect(
      run(locked, setAttr(A, 'region', 'actions'), withUnlock(true)).doc.nodes[A]?.region,
    ).toBe('actions');
  });
});

describe('node.setAttr in general', () => {
  it('a missing node, an unknown key and a malformed payload', () => {
    expect(rejected(doc(), setAttr(X, 'name', 'x')).reason?.code).toBe('node-not-found');
    for (const payload of [
      null,
      {},
      { id: A, key: 'nope', value: 1 },
      { id: A, key: 'name' },
      { id: A, key: 'name', value: 'x', extra: 1 },
    ]) {
      expect(rejected(doc(), { type: 'node.setAttr', payload }).code).toBe(
        'command.invalid-payload',
      );
    }
  });

  it('undo restores the exact document, and patches redo', () => {
    const before = doc({ name: 'Old', lock: { content: true } });
    for (const command of [
      setAttr(A, 'name', 'New'),
      setAttr(A, 'name', null),
      setAttr(B, 'anchor', 'fresh'),
      setAttr(A, 'lock', null),
    ]) {
      const result = run(before, command, withUnlock(true));
      const undone = applyDocumentPatches(result.doc, result.inverse);
      expect(undone.ok && undone.value).toEqual(before);
      const redone = applyDocumentPatches(before, result.patches);
      expect(redone.ok && redone.value).toEqual(result.doc);
    }
  });

  it('setting the same value or removing an absent one changes nothing', () => {
    const d = doc({ name: 'Same' });
    expect(run(d, setAttr(A, 'name', 'Same')).doc).toBe(d);
    expect(run(d, setAttr(B, 'name', null)).doc).toBe(d);
  });

  it('coalesces by attr:<id>:<key>, and canExecute agrees', () => {
    expect(setAttrHandler.mergeKey?.(setAttr(A, 'name', 'x') as never)).toBe(`attr:${A}:name`);
    expect(canExecute(doc(), setAttr(A, 'name', 'x'), env).ok).toBe(true);
    expect(canExecute(doc(), setAttr(A, 'anchor', 'taken'), env).ok).toBe(false);
  });
});
