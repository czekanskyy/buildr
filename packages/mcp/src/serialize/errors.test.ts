import { readdirSync, readFileSync } from 'node:fs';
import { canInsert, canRemove, createIndex, type Reason } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { describe, expect, it } from 'vitest';
import { createEditSession, sessionError } from '../session/index.ts';
import { loadDefaultManifest, loadDefaultRegistry } from './default-manifest.test-kit.ts';
import { documentFromTree } from './document.test-kit.ts';
import {
  COMMAND_EXPLAINERS,
  explainCommandError,
  explainReason,
  explainSessionError,
  formatAgentError,
  REASON_EXPLAINERS,
} from './errors.ts';

const registry = loadDefaultRegistry();
const coreSrc = new URL('../../../core/src/', import.meta.url);

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) return entry.name === '__property__' ? [] : sourceFiles(url);
    return /\.ts$/.test(entry.name) && !/\.test(-kit)?\.ts$/.test(entry.name) ? [url] : [];
  });
}

describe('every rejection code has an explanation', () => {
  it('covers every ReasonCode declared in core', () => {
    const source = readFileSync(new URL('rules/reasons.ts', coreSrc), 'utf8');
    const union = /export type ReasonCode =([^;]+);/.exec(source)?.[1] ?? '';
    const declared = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1] as string);
    expect(declared.length).toBeGreaterThan(20);
    expect(Object.keys(REASON_EXPLAINERS).sort()).toEqual([...declared].sort());
  });

  it('covers every ReasonCode that core rules actually emit', () => {
    const emitted = new Set<string>();
    for (const file of sourceFiles(new URL('rules/', coreSrc))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/reason\(\s*'([a-z-]+)'/g)) {
        emitted.add(m[1] as string);
      }
    }
    for (const code of emitted) expect(REASON_EXPLAINERS, code).toHaveProperty(code);
  });

  it.each(Object.keys(REASON_EXPLAINERS))('explains %s as one non-empty sentence', (code) => {
    const explained = explainReason(
      { code: code as Reason['code'], message: 'core message', params: {} },
      { registry },
    );
    expect(explained.code).toBe(code);
    expect(explained.message.length).toBeGreaterThan(10);
    expect(explained.message).not.toContain('undefined');
    expect(explained.message.match(/\.\s+[A-Z]/g) ?? []).toHaveLength(0); // one sentence
  });

  it('covers every command error code core emits', () => {
    const emitted = new Set<string>();
    for (const file of sourceFiles(new URL('commands/', coreSrc))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/'(command\.[a-z-]+)'/g)) {
        emitted.add(m[1] as string);
      }
    }
    expect(emitted.size).toBeGreaterThan(20);
    for (const code of emitted) expect(COMMAND_EXPLAINERS, code).toHaveProperty(code);
  });
});

describe('explainReason', () => {
  const doc = documentFromTree({
    type: 'buildr/page',
    children: [
      { type: 'buildr/section', children: [{ type: 'buildr/heading' }] },
      { type: 'buildr/list', children: [{ type: 'buildr/list-item' }] },
    ],
  });
  const index = createIndex(doc);
  const sectionId = doc.nodes.root?.slots?.['default']?.[0] as string;
  const listId = doc.nodes.root?.slots?.['default']?.[1] as string;

  it('names the allowed children when a slot refuses a component', () => {
    const verdict = canInsert(
      doc,
      index,
      registry,
      { parentId: listId, slot: 'default' },
      'buildr/heading',
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    const explained = explainReason(verdict.error, { registry, doc });
    expect(explained.message).toMatch(
      /buildr\/heading cannot be placed in slot "default" of buildr\/list/,
    );
    expect(explained.message).toContain('allowed children of buildr/list are: ');
    expect(explained.alternatives).toContain('buildr/loop');
  });

  it('tells how to add a component that cannot be inserted alone', () => {
    const verdict = canInsert(
      doc,
      index,
      registry,
      { parentId: listId, slot: 'default' },
      'buildr/list-item',
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    const message = explainReason(verdict.error, { registry, doc }).message;
    expect(message).toContain('duplicate an existing');
    expect(message).toContain('buildr/list');
  });

  it('names the valid parents when a component refuses its parent', () => {
    const verdict = canInsert(
      doc,
      index,
      registry,
      { parentId: sectionId, slot: 'default' },
      'buildr/list-item',
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    const explained = explainReason(verdict.error, { registry, doc });
    expect(formatAgentError(explained)).toContain('buildr/list');
  });

  it('points a form control at a form', () => {
    const verdict = canInsert(
      doc,
      index,
      registry,
      { parentId: sectionId, slot: 'default' },
      'buildr/input',
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(explainReason(verdict.error, { registry, doc }).message).toContain('buildr/form');
  });

  it('suggests a close type for an unknown one', () => {
    const explained = explainReason(
      { code: 'unknown-component-type', message: 'x', params: { type: 'buildr/headng' } },
      { registry },
    );
    expect(explained.alternatives?.[0]).toBe('buildr/heading');
  });

  it('explains the last child of a slot that needs one', () => {
    const accordionDoc = documentFromTree({
      type: 'buildr/page',
      children: [{ type: 'buildr/accordion', children: [{ type: 'buildr/accordion-item' }] }],
    });
    const accordion = accordionDoc.nodes.root?.slots?.['default']?.[0] as string;
    const item = accordionDoc.nodes[accordion]?.slots?.['default']?.[0] as string;
    const verdict = canRemove(accordionDoc, createIndex(accordionDoc), registry, item);
    if (!verdict.ok) {
      expect(explainReason(verdict.error, { registry, doc: accordionDoc }).message).toContain(
        'replace',
      );
    }
  });
});

describe('explainCommandError and explainSessionError', () => {
  function session() {
    const created = createEditSession({
      id: 's',
      ref: { collection: 'pages', id: '1' },
      userId: 'u',
      revision: 1,
      layoutSource: 'document',
      layoutRef: null,
      contextRef: 'pages:1',
      previewPath: null,
      document: documentFromTree({
        type: 'buildr/page',
        children: [{ type: 'buildr/heading', props: { text: 'Hi' } }],
      }),
      readOnly: false,
      manifest: loadDefaultManifest(),
      limits: { maxNodes: 5000, maxBytes: 2_000_000 },
      canUnlockTemplates: false,
      clock: () => 0,
    });
    if (!created.ok) throw new Error(created.error.message);
    return created.value;
  }

  it('names the failing command and the valid props for an unknown prop', () => {
    const s = session();
    const id = Object.values(s.doc.nodes).find((n) => n.type === 'buildr/heading')?.id as string;
    const commands: Command[] = [
      { type: 'node.setProp', payload: { id, prop: 'txt', value: { kind: 'static', value: 'x' } } },
    ];
    const result = s.apply(commands);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const explained = explainSessionError(result.error, {
      registry: s.registry,
      doc: s.doc,
      commands,
    });
    expect(explained.message).toContain('Command 1 (node.setProp)');
    expect(explained.message).toContain('Its props are: text, level');
    expect(explained.message).toContain('Nothing was applied.');
    expect(explained.alternatives).toEqual(['text']);
    expect(explained.nodeId).toBe(id);
  });

  it('explains a rejected insert through the rule reason', () => {
    const s = session();
    const commands: Command[] = [
      {
        type: 'node.insert',
        payload: {
          parentId: 'root',
          slot: 'nope',
          index: 0,
          fragment: {
            format: 'buildr/fragment',
            schemaVersion: 1,
            components: { 'buildr/heading': 1 },
            roots: ['a000000001'],
            nodes: { a000000001: { id: 'a000000001', type: 'buildr/heading' } },
          },
        },
      },
    ];
    const result = s.apply(commands);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const explained = explainSessionError(result.error, {
      registry: s.registry,
      doc: s.doc,
      commands,
    });
    expect(explained.message).toContain('buildr/page has no slot "nope"');
    expect(explained.alternatives).toEqual(['default']);
  });

  it('falls back to core message for an unknown command error code', () => {
    const explained = explainCommandError(
      { code: 'command.future-thing', message: 'Something odd' },
      { registry },
    );
    expect(explained.message).toBe('Something odd.');
  });

  it('adds advice to session errors', () => {
    const explained = explainSessionError(sessionError('session-not-found', 'No such session'), {
      registry,
    });
    expect(explained.message).toContain('open_document');
  });
});
