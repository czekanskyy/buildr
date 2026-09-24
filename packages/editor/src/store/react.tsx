import type { NodeId, PageNode, SlotName } from '@buildr/core';
import { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';
import { selectChildren, selectIsDirty, selectNode, selectSelectedNode } from './selectors.ts';
import type { EditorState, EditorStore } from './types.ts';

const StoreContext = createContext<EditorStore | undefined>(undefined);

export function EditorStoreProvider(props: {
  readonly store: EditorStore;
  readonly children: ReactNode;
}) {
  return <StoreContext.Provider value={props.store}>{props.children}</StoreContext.Provider>;
}

/** The store itself, for reading it outside a render or calling its actions. */
export function useEditor(): EditorStore {
  const store = useContext(StoreContext);
  if (store === undefined) throw new Error('useEditor must be used inside <EditorStoreProvider>');
  return store;
}

/** Subscribes to a part of the state; the component renders again only when that part changes. */
export function useEditorState<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditor(), selector);
}

/** One node; the component renders again only when that node does. */
export function useNode(id: NodeId): PageNode | undefined {
  return useEditorState((state) => selectNode(state, id));
}

export function useSelectedNode(): PageNode | undefined {
  return useEditorState(selectSelectedNode);
}

export function useNodeChildren(id: NodeId, slot: SlotName = 'default'): readonly NodeId[] {
  return useEditorState((state) => selectChildren(state, id, slot));
}

export function useIsDirty(): boolean {
  return useEditorState(selectIsDirty);
}
