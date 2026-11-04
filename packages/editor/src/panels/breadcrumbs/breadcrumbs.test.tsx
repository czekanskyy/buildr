// @vitest-environment jsdom

import { type BuilderDocument, createRegistryMeta, type RegistryManifest } from '@next-buildr/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ManifestProvider } from '../../app/manifest.tsx';
import { MessagesProvider } from '../../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../../store/index.ts';
import { Breadcrumbs } from './breadcrumbs.tsx';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const doc: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['boxNode001'] } },
    boxNode001: {
      id: 'boxNode001',
      type: 'buildr/box',
      name: 'Hero',
      slots: { default: ['textNodeA1'] },
    },
    textNodeA1: { id: 'textNodeA1', type: 'buildr/text' },
  },
  components: {},
};

afterEach(() => {
  document.body.innerHTML = '';
});

const manifest = {
  manifestVersion: 1,
  components: { 'buildr/text': { label: 'Paragraph' }, 'buildr/page': { label: 'Page' } },
  templates: [],
} as unknown as RegistryManifest;

describe('Breadcrumbs', () => {
  it('shows the path, marks the hovered node and selects a step on click', async () => {
    const store = createEditorStore({
      doc,
      registry: createRegistryMeta({ components: [] }),
      validationDelayMs: null,
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <ManifestProvider manifest={manifest}>
            <EditorStoreProvider store={store}>
              <Breadcrumbs />
            </EditorStoreProvider>
          </ManifestProvider>
        </MessagesProvider>,
      ),
    );
    expect(container.querySelector('nav')).toBeNull();

    await act(async () => store.select('textNodeA1'));
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Page', 'Hero', 'Paragraph']);
    expect(buttons[2]?.getAttribute('aria-current')).toBe('location');
    expect(container.querySelectorAll('li > svg')).toHaveLength(2);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Selection path');
    expect(await axe(container)).toHaveNoViolations();

    await act(async () => buttons[1]?.focus());
    expect(store.getState().hoveredId).toBe('boxNode001');

    await act(async () => buttons[1]?.click());
    expect(store.getState().selectedIds).toEqual(['boxNode001']);
    await act(async () => root.unmount());
  });
});
