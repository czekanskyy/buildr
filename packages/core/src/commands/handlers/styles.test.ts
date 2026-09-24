import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { NodeStyles } from '../../document/style-types.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, env, ID, node, snapshot } from './handlers.test-kit.ts';
import type { StyleLayer } from './styles.ts';
import { setStyleHandler, unsetStyleHandler } from './styles.ts';

const N = ID(1);
const X = ID(9);

const doc = (styles?: NodeStyles, extra = {}) =>
  buildDoc([node(N, 'buildr/section', [], { ...(styles ? { styles } : {}), ...extra })], [N]);

type Args = { layer?: StyleLayer; side?: string; id?: string };
const setStyle = (
  group: string,
  property: string,
  value: unknown,
  { layer = {}, side, id = N }: Args = {},
) => cmd('node.setStyle', { id, layer, group, property, value, ...(side ? { side } : {}) });
const unsetStyle = (group: string, property: string, { layer = {}, side, id = N }: Args = {}) =>
  cmd('node.unsetStyle', { id, layer, group, property, ...(side ? { side } : {}) });
const resetStyles = (layer?: StyleLayer, id = N) =>
  cmd('node.resetStyles', { id, ...(layer ? { layer } : {}) });

type AnyCommand =
  | ReturnType<typeof setStyle>
  | ReturnType<typeof unsetStyle>
  | ReturnType<typeof resetStyles>;

function run(d: ReturnType<typeof doc>, command: AnyCommand) {
  const result = execute(d, command, env);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

const stylesOf = (d: ReturnType<typeof doc>) => d.nodes[N]?.styles;

function rejected(d: ReturnType<typeof doc>, command: Parameters<typeof execute>[1]) {
  const before = snapshot(d);
  const result = execute(d, command, env);
  expect(snapshot(d)).toBe(before);
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

describe('node.setStyle', () => {
  it('sets a value on the desktop layer, a breakpoint and a pseudo-state', () => {
    let d = run(doc(), setStyle('layout', 'display', 'flex')).doc;
    d = run(d, setStyle('layout', 'gap', '$space.4', { layer: { bp: 'tablet' } })).doc;
    d = run(d, setStyle('effects', 'opacity', 0.5, { layer: { state: 'hover' } })).doc;
    expect(stylesOf(d)).toEqual({
      base: { layout: { display: 'flex' } },
      bp: { tablet: { layout: { gap: '$space.4' } } },
      state: { hover: { effects: { opacity: 0.5 } } },
    });
  });

  it('overwrites a value and keeps the other properties', () => {
    const start = doc({ base: { layout: { display: 'flex', gap: '1rem' } } });
    const next = run(start, setStyle('layout', 'gap', '2rem')).doc;
    expect(stylesOf(next)).toEqual({ base: { layout: { display: 'flex', gap: '2rem' } } });
  });

  it('sets one side or corner, and a whole box from an object', () => {
    let d = run(doc(), setStyle('spacing', 'margin', '1rem', { side: 'top' })).doc;
    d = run(d, setStyle('spacing', 'margin', '2rem', { side: 'left' })).doc;
    d = run(d, setStyle('border', 'radius', '$radius.md', { side: 'topLeft' })).doc;
    expect(stylesOf(d)?.base).toEqual({
      spacing: { margin: { top: '1rem', left: '2rem' } },
      border: { radius: { topLeft: '$radius.md' } },
    });
    const replaced = run(d, setStyle('spacing', 'margin', { bottom: '3rem' })).doc;
    expect(stylesOf(replaced)?.base?.spacing).toEqual({ margin: { bottom: '3rem' } });
  });

  it('accepts the boolean property and stores the value as written', () => {
    expect(stylesOf(run(doc(), setStyle('visibility', 'hidden', true)).doc)).toEqual({
      base: { visibility: { hidden: true } },
    });
    expect(
      stylesOf(run(doc(), setStyle('typography', 'color', '$color.primary')).doc)?.base?.typography,
    ).toEqual({ color: '$color.primary' });
  });

  it('undo restores the document exactly, and patches redo', () => {
    const before = doc({ base: { layout: { display: 'flex' } } });
    for (const command of [
      setStyle('layout', 'gap', '1rem'),
      setStyle('layout', 'gap', '1rem', { layer: { bp: 'mobile' } }),
      unsetStyle('layout', 'display'),
      resetStyles(),
    ]) {
      const result = run(before, command);
      const undone = applyDocumentPatches(result.doc, result.inverse);
      expect(undone.ok && undone.value).toEqual(before);
      const redone = applyDocumentPatches(before, result.patches);
      expect(redone.ok && redone.value).toEqual(result.doc);
    }
  });

  it('does not mutate its input', () => {
    const d = doc({ base: { layout: { display: 'flex' } } });
    const before = snapshot(d);
    run(d, setStyle('layout', 'gap', '1rem'));
    run(d, unsetStyle('layout', 'display'));
    expect(snapshot(d)).toBe(before);
  });
});

describe('node.setStyle rejections', () => {
  it('values outside the property grammar', () => {
    for (const value of [
      'red;}body{',
      'url(x)',
      'calc(1px)',
      'expression(x)',
      '1px !important',
      '',
      5,
      true,
    ]) {
      expect(rejected(doc(), setStyle('layout', 'gap', value)).code).toBe('command.invalid-value');
    }
    expect(rejected(doc(), setStyle('layout', 'display', 'flexy')).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setStyle('spacing', 'margin', { top: 'nope' })).code).toBe(
      'command.invalid-value',
    );
  });

  it('an unknown property, group, side or corner', () => {
    expect(rejected(doc(), setStyle('layout', 'nope', '1px')).code).toBe(
      'command.unknown-style-property',
    );
    expect(rejected(doc(), setStyle('nope', 'gap', '1px')).code).toBe('command.invalid-payload');
    expect(rejected(doc(), setStyle('spacing', 'margin', '1px', { side: 'middle' })).code).toBe(
      'command.invalid-side',
    );
    expect(rejected(doc(), setStyle('spacing', 'margin', { middle: '1px' })).code).toBe(
      'command.invalid-side',
    );
    expect(rejected(doc(), setStyle('layout', 'gap', '1px', { side: 'top' })).code).toBe(
      'command.invalid-side',
    );
  });

  it('a shaped property needs a side or an object; an object needs a shaped property', () => {
    expect(rejected(doc(), setStyle('spacing', 'margin', '1px')).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setStyle('layout', 'gap', { top: '1px' })).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setStyle('spacing', 'margin', {})).code).toBe('command.invalid-value');
    expect(
      rejected(doc(), setStyle('spacing', 'margin', { top: '1px' }, { side: 'top' })).code,
    ).toBe('command.invalid-value');
  });

  it('a property that cannot be set in a pseudo-state', () => {
    expect(
      rejected(doc(), setStyle('layout', 'display', 'flex', { layer: { state: 'hover' } })).code,
    ).toBe('command.not-allowed-in-state');
  });

  it('a layer that is both, or "base" spelled as a breakpoint', () => {
    expect(
      rejected(doc(), setStyle('layout', 'gap', '1px', { layer: { bp: 'tablet', state: 'hover' } }))
        .code,
    ).toBe('command.invalid-layer');
    expect(rejected(doc(), setStyle('layout', 'gap', '1px', { layer: { bp: 'base' } })).code).toBe(
      'command.invalid-layer',
    );
    expect(
      rejected(doc(), setStyle('layout', 'gap', '1px', { layer: { bp: '__proto__' } })).code,
    ).toBe('command.invalid-payload');
  });

  it('a ninth breakpoint on one node', () => {
    const many = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`bp${i}`, { layout: { gap: '1px' } }]),
    );
    const d = doc({ bp: many });
    expect(rejected(d, setStyle('layout', 'gap', '1px', { layer: { bp: 'extra' } })).code).toBe(
      'command.limit-exceeded',
    );
    expect(execute(d, setStyle('layout', 'gap', '2px', { layer: { bp: 'bp3' } }), env).ok).toBe(
      true,
    );
  });

  it('a missing node and a style-locked node', () => {
    expect(rejected(doc(), setStyle('layout', 'gap', '1px', { id: X })).reason?.code).toBe(
      'node-not-found',
    );
    expect(
      rejected(doc(undefined, { lock: { style: true } }), setStyle('layout', 'gap', '1px')).reason
        ?.code,
    ).toBe('locked-style');
  });

  it('a malformed payload', () => {
    for (const payload of [
      null,
      {},
      { id: N, layer: {}, group: 'layout', property: 'gap' },
      { id: N, layer: {}, group: 'layout', property: 'gap', value: '1px', extra: 1 },
      { id: N, layer: { bp: 3 }, group: 'layout', property: 'gap', value: '1px' },
    ]) {
      expect(rejected(doc(), { type: 'node.setStyle', payload }).code).toBe(
        'command.invalid-payload',
      );
    }
  });

  it('canExecute agrees', () => {
    expect(canExecute(doc(), setStyle('layout', 'gap', '1px'), env).ok).toBe(true);
    expect(canExecute(doc(), setStyle('layout', 'gap', 'url(x)'), env).ok).toBe(false);
  });
});

describe('node.unsetStyle cleans up after itself', () => {
  it('removes a property and every empty object above it', () => {
    const d = doc({ base: { layout: { display: 'flex' } } });
    expect(d.nodes[N]?.styles).toBeDefined();
    expect(run(d, unsetStyle('layout', 'display')).doc.nodes[N]).not.toHaveProperty('styles');
  });

  it('keeps siblings, and empties only what became empty', () => {
    const d = doc({
      base: { layout: { display: 'flex', gap: '1px' } },
      bp: { tablet: { layout: { gap: '2px' } } },
    });
    const next = run(d, unsetStyle('layout', 'gap', { layer: { bp: 'tablet' } })).doc;
    expect(stylesOf(next)).toEqual({ base: { layout: { display: 'flex', gap: '1px' } } });
  });

  it('removes one side, then the whole box once no side is left', () => {
    const d = doc({ base: { spacing: { margin: { top: '1px', left: '2px' } } } });
    const one = run(d, unsetStyle('spacing', 'margin', { side: 'top' })).doc;
    expect(stylesOf(one)).toEqual({ base: { spacing: { margin: { left: '2px' } } } });
    expect(
      run(one, unsetStyle('spacing', 'margin', { side: 'left' })).doc.nodes[N],
    ).not.toHaveProperty('styles');
    expect(run(d, unsetStyle('spacing', 'margin')).doc.nodes[N]).not.toHaveProperty('styles');
  });

  it('removing something that is not there changes nothing', () => {
    const d = doc({ base: { layout: { display: 'flex' } } });
    for (const command of [
      unsetStyle('layout', 'gap'),
      unsetStyle('layout', 'display', { layer: { bp: 'tablet' } }),
      unsetStyle('spacing', 'margin', { side: 'top' }),
    ]) {
      const result = run(d, command);
      expect(result.doc).toBe(d);
      expect(result.patches).toEqual([]);
    }
    expect(run(doc(), unsetStyle('layout', 'gap')).doc.nodes[N]).not.toHaveProperty('styles');
  });

  it('rejects the same things setStyle does', () => {
    expect(rejected(doc(), unsetStyle('layout', 'nope')).code).toBe(
      'command.unknown-style-property',
    );
    expect(
      rejected(doc(), unsetStyle('layout', 'display', { layer: { state: 'hover' } })).code,
    ).toBe('command.not-allowed-in-state');
    expect(
      rejected(doc(undefined, { lock: { style: true } }), unsetStyle('layout', 'gap')).reason?.code,
    ).toBe('locked-style');
  });
});

describe('node.resetStyles', () => {
  const styled = () =>
    doc({
      base: { layout: { display: 'flex' } },
      bp: { tablet: { layout: { gap: '1px' } }, mobile: { layout: { gap: '2px' } } },
      state: { hover: { effects: { opacity: 0.5 } } },
    });

  it('clears one layer and leaves the others', () => {
    expect(stylesOf(run(styled(), resetStyles({ bp: 'tablet' })).doc)).toEqual({
      base: { layout: { display: 'flex' } },
      bp: { mobile: { layout: { gap: '2px' } } },
      state: { hover: { effects: { opacity: 0.5 } } },
    });
    expect(stylesOf(run(styled(), resetStyles({})).doc)).toEqual({
      bp: { tablet: { layout: { gap: '1px' } }, mobile: { layout: { gap: '2px' } } },
      state: { hover: { effects: { opacity: 0.5 } } },
    });
    expect(stylesOf(run(styled(), resetStyles({ state: 'hover' })).doc)?.state).toBeUndefined();
  });

  it('clears the whole node when no layer is given, leaving no empty object', () => {
    expect(run(styled(), resetStyles()).doc.nodes[N]).not.toHaveProperty('styles');
  });

  it('resetting the last layer drops styles entirely', () => {
    const d = doc({ base: { layout: { display: 'flex' } } });
    expect(run(d, resetStyles({})).doc.nodes[N]).not.toHaveProperty('styles');
  });

  it('resetting nothing changes nothing; a bad node or lock is rejected', () => {
    const plain = doc();
    expect(run(plain, resetStyles()).doc).toBe(plain);
    const one = doc({ base: { layout: { display: 'flex' } } });
    expect(run(one, resetStyles({ bp: 'tablet' })).doc).toBe(one);
    expect(rejected(doc(), resetStyles(undefined, X)).reason?.code).toBe('node-not-found');
    expect(rejected(doc({ base: {} }, { lock: { style: true } }), resetStyles()).reason?.code).toBe(
      'locked-style',
    );
    expect(rejected(doc(), resetStyles({ bp: 'tablet', state: 'hover' })).code).toBe(
      'command.invalid-layer',
    );
  });
});

describe('no empty objects remain (property)', () => {
  const layers = fc.constantFrom<StyleLayer>(
    {},
    { bp: 'tablet' },
    { bp: 'mobile' },
    { state: 'hover' },
  );
  const setOp = fc.record({
    layer: layers,
    prop: fc.constantFrom(['effects', 'opacity', 0.5], ['effects', 'cursor', 'pointer']),
  });
  const unsetOp = fc.record({
    layer: layers,
    prop: fc.constantFrom(['effects', 'opacity'], ['effects', 'cursor']),
  });

  function hasEmptyObject(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const entries = Object.values(value);
    return entries.length === 0 || entries.some(hasEmptyObject);
  }

  it('any sequence of set/unset/reset leaves styles without empty objects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            setOp.map((o) =>
              setStyle(o.prop[0] as string, o.prop[1] as string, o.prop[2], { layer: o.layer }),
            ),
            unsetOp.map((o) =>
              unsetStyle(o.prop[0] as string, o.prop[1] as string, { layer: o.layer }),
            ),
            layers.map((layer) => resetStyles(layer)),
          ),
          { maxLength: 12 },
        ),
        (commands) => {
          let current = doc();
          for (const command of commands) {
            const result = execute(current, command, env);
            if (!result.ok) continue;
            current = result.value.doc;
            expect(hasEmptyObject(current.nodes[N]?.styles)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('coalescing keys', () => {
  it('follow setStyle:<id>:<group>.<property>[.<side>]:<layer>', () => {
    const key = (command: { payload: never }) => setStyleHandler.mergeKey?.(command as never);
    expect(
      key(setStyle('spacing', 'padding', '1px', { side: 'top', layer: { bp: 'mobile' } })),
    ).toBe(`setStyle:${N}:spacing.padding.top:mobile`);
    expect(key(setStyle('layout', 'gap', '1px'))).toBe(`setStyle:${N}:layout.gap:base`);
    expect(key(setStyle('effects', 'opacity', 1, { layer: { state: 'hover' } }))).toBe(
      `setStyle:${N}:effects.opacity:state:hover`,
    );
    expect(unsetStyleHandler.mergeKey?.(unsetStyle('layout', 'gap') as never)).toBe(
      `setStyle:${N}:layout.gap:base`,
    );
  });
});
