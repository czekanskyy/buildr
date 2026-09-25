// @vitest-environment jsdom
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  p,
  s,
} from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesProvider } from '../messages/index.tsx';
import {
  collectIssues,
  countIssues,
  filterIssues,
  type IssueItem,
  IssuesPanel,
  publishGate,
} from '../panels/issues/index.ts';
import {
  createPersistence,
  type DocumentAdapter,
  PersistenceProvider,
  type PublishResult,
} from '../persistence/index.ts';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { ToastProvider } from '../ui/index.ts';
import { PublishDialog } from './publish-dialog.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const widget: ComponentMeta = {
  type: 'buildr/widget',
  version: 1,
  label: 'Widget',
  category: 'content',
  props: { count: p.number({ default: 1, min: 0, max: 10 }) },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: { default: {} },
};
const page: ComponentMeta = {
  ...widget,
  type: 'buildr/page',
  label: 'Page',
  props: {},
  capabilities: { root: true },
};
const registry = createRegistryMeta({ components: [page, widget] });

/** `count` is a string where a number is expected: an error, but the page still renders. */
const versions = { 'buildr/page': 1, 'buildr/widget': 1 };
const broken = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['widget0001'] } },
    widget0001: { id: 'widget0001', type: 'buildr/widget', props: { count: s('many') } },
  },
  components: versions,
});
/** No version recorded for the components: the document is damaged. */
const corrupt = (): BuilderDocument => ({ ...broken(), components: {} });
const clean = (): BuilderDocument => ({
  ...broken(),
  nodes: {
    ...broken().nodes,
    widget0001: { id: 'widget0001', type: 'buildr/widget' },
  },
});

const item = (over: Partial<IssueItem>): IssueItem => ({
  key: 'k',
  source: 'validation',
  severity: 'warning',
  code: 'x',
  message: 'm',
  blocking: false,
  ...over,
});

describe('issue collection and the publish gate', () => {
  it('orders worst first and drops nodes that are gone', () => {
    const items = collectIssues({
      doc: clean(),
      validation: [
        {
          code: 'a',
          message: 'gone',
          severity: 'warning',
          blocking: false,
          path: ['nodes', 'nope'],
        },
        {
          code: 'b',
          message: 'here',
          severity: 'error',
          blocking: false,
          path: ['nodes', 'widget0001', 'props'],
        },
      ],
      a11y: [{ ruleId: 'r', severity: 'info', nodeId: 'widget0001', message: 'note' }],
    });
    expect(items.map((entry) => entry.message)).toEqual(['here', 'gone', 'note']);
    expect(items[0]?.nodeId).toBe('widget0001');
    expect(items[1]?.nodeId).toBeUndefined();
    expect(countIssues(items)).toEqual({ all: 3, error: 1, warning: 1, info: 1 });
    expect(filterIssues(items, 'warning')).toHaveLength(1);
  });

  it('blocks on corruption always and on errors only under the block policy', () => {
    const error = [item({ severity: 'error' })];
    expect(publishGate(error).blocked).toBe(false);
    expect(publishGate(error, 'warn').blocked).toBe(false);
    expect(publishGate(error, 'block')).toMatchObject({ blocked: true, reason: 'errors' });
    expect(publishGate([item({ blocking: true, severity: 'error' })], 'warn')).toMatchObject({
      blocked: true,
      reason: 'blocking',
    });
    expect(publishGate([item({})], 'block').blocked).toBe(false);
  });
});

describe('the Issues panel and the publish dialog', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  function setup(doc: BuilderDocument, policy: 'warn' | 'block', publishResult?: PublishResult) {
    const publish = vi.fn(
      async (): Promise<PublishResult> =>
        publishResult ?? { ok: true, revision: 3, updatedAt: 't3' },
    );
    const adapter = {
      save: async () => ({ ok: true as const, revision: 2, updatedAt: 't2' }),
      publish,
    } as unknown as DocumentAdapter;
    const store = createEditorStore({
      doc,
      registry,
      generateId: createSeededIdGenerator(5),
      validationDelayMs: null,
    });
    const controller = createPersistence({
      store,
      adapter,
      ref: { collection: 'pages', id: '1' },
      revision: 1,
    });
    const view = async (open: boolean) =>
      act(async () =>
        root.render(
          <MessagesProvider locale="en">
            <EditorStoreProvider store={store}>
              <ToastProvider>
                <PersistenceProvider controller={controller}>
                  <IssuesPanel />
                  <PublishDialog open={open} onOpenChange={() => undefined} policy={policy} />
                </PersistenceProvider>
              </ToastProvider>
            </EditorStoreProvider>
          </MessagesProvider>,
        ),
      );
    return { store, publish, view };
  }

  const publishButton = () =>
    [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Publish',
    ) as HTMLButtonElement;

  it('lists an issue and selects its node when it is clicked', async () => {
    const { store, view } = setup(broken(), 'warn');
    await view(false);
    await act(async () => void store.validateNow());
    const target = container.querySelector('.bd-issue-target') as HTMLButtonElement;
    expect(target).not.toBeNull();
    await act(async () => target.click());
    expect(store.getState().selectedIds).toEqual(['widget0001']);
  });

  it('groups issues by severity, with severity and component icons', async () => {
    const { store, view } = setup(broken(), 'warn');
    await view(false);
    await act(async () => void store.validateNow());
    const sections = [...container.querySelectorAll('.bd-issues-severity')];
    expect(sections.length).toBeGreaterThan(0);
    const order = sections.map((section) => section.getAttribute('data-severity'));
    expect(order).toEqual(['error', 'warning', 'info'].filter((sev) => order.includes(sev)));
    for (const section of sections) {
      expect(section.querySelector('.bd-issues-heading svg')).not.toBeNull();
      expect(section.querySelector('.bd-issue-severity[role=img]')).not.toBeNull();
      expect(section.querySelector('.bd-issue-owner')?.textContent).not.toBe('');
    }
  });

  it('shows the publish counts as icon badges with a spoken text', async () => {
    const { view } = setup(broken(), 'warn');
    await view(true);
    const badges = [...document.querySelectorAll('.bd-publish-badge')];
    expect(badges.map((badge) => badge.getAttribute('data-severity'))).toEqual([
      'error',
      'warning',
      'info',
    ]);
    for (const badge of badges) expect(badge.querySelector('svg')).not.toBeNull();
    expect(badges[0]?.textContent).toMatch(/[0-9] errors/);
  });

  it('refuses to publish while errors exist under the block policy', async () => {
    const { publish, view } = setup(broken(), 'block');
    await view(true);
    expect(document.body.textContent).toContain('Publishing is blocked');
    expect(publishButton().disabled).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('warns but publishes under the warn policy, after saving', async () => {
    const { store, publish, view } = setup(broken(), 'warn');
    await view(true);
    expect(document.body.textContent).toContain('You can still publish');
    expect(document.body.textContent).toContain('replaces the live page');
    await act(async () => {
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: 'widget0001', key: 'name', value: 'A' },
      } as never);
    });
    await act(async () => publishButton().click());
    expect(publish).toHaveBeenCalledWith(expect.anything(), { baseRevision: 2 });
    expect(document.body.textContent).toContain('Published.');
  });

  it('refuses a damaged document under any policy', async () => {
    const { publish, view } = setup(corrupt(), 'warn');
    await view(true);
    expect(document.body.textContent).toContain('damaged');
    expect(publishButton().disabled).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes a clean document', async () => {
    const { publish, view } = setup(clean(), 'block');
    await view(true);
    await act(async () => publishButton().click());
    expect(publish).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain('Published.');
  });

  it('shows why a publication failed', async () => {
    const { view } = setup(clean(), 'block', { ok: false, kind: 'conflict', currentRevision: 9 });
    await view(true);
    await act(async () => publishButton().click());
    expect(document.body.textContent).toContain('changed elsewhere');
  });
});

describe('PersistenceController.publish', () => {
  function controllerFor(save: unknown, publish: unknown) {
    const store = createEditorStore({
      doc: clean(),
      registry,
      generateId: createSeededIdGenerator(5),
      validationDelayMs: null,
    });
    const controller = createPersistence({
      store,
      adapter: { save, publish } as unknown as DocumentAdapter,
      ref: { collection: 'pages', id: '1' },
      revision: 1,
    });
    controller.start();
    act(() => {
      store.dispatch({
        type: 'node.setAttr',
        payload: { id: 'widget0001', key: 'name', value: 'A' },
      });
    });
    return controller;
  }

  it('does not publish what it could not save', async () => {
    const publish = vi.fn();
    const controller = controllerFor(
      async () => ({ ok: false, kind: 'invalid', diagnostics: [] }),
      publish,
    );
    expect(await controller.publish()).toEqual({ ok: false, kind: 'unsaved' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('turns a rejection into an outcome and keeps the revision on success', async () => {
    const failing = controllerFor(
      async () => ({ ok: true, revision: 2, updatedAt: 't' }),
      async () => {
        throw new Error('offline');
      },
    );
    expect(await failing.publish()).toEqual({ ok: false, kind: 'network', message: 'offline' });

    const working = controllerFor(
      async () => ({ ok: true, revision: 2, updatedAt: 't' }),
      async () => ({ ok: true, revision: 4, updatedAt: 'u' }),
    );
    expect(await working.publish()).toMatchObject({ ok: true, revision: 4 });
    expect(working.state.getState().revision).toBe(4);
  });

  it('moves to the conflict state when the backend says so', async () => {
    const controller = controllerFor(
      async () => ({ ok: true, revision: 2, updatedAt: 't' }),
      async () => ({ ok: false, kind: 'conflict', currentRevision: 8 }),
    );
    expect(await controller.publish()).toMatchObject({ ok: false, kind: 'conflict' });
    expect(controller.state.getState()).toMatchObject({ status: 'conflict', conflictRevision: 8 });
  });
});
