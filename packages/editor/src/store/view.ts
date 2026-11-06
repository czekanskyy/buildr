import type { NodeId } from '@next-buildr/core';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** Session presentation only: never included in the document or persistence state. */
export interface ViewState {
  readonly insertionTarget: {
    readonly parentId: NodeId;
    readonly slot: string;
    readonly index: number;
  } | null;
  setInsertionTarget(target: ViewState['insertionTarget']): void;
  readonly outlines: boolean;
  readonly hiddenIds: readonly NodeId[];
  toggleOutlines(): void;
  setOutlines(outlines: boolean): void;
  setHiddenIds(ids: readonly NodeId[]): void;
  toggleHidden(id: NodeId): void;
}

export type ViewStore = StoreApi<ViewState>;

export function createViewStore(): ViewStore {
  return createStore<ViewState>((set) => ({
    insertionTarget: null,
    setInsertionTarget: (insertionTarget) => set({ insertionTarget }),
    outlines: false,
    hiddenIds: [],
    toggleOutlines: () => set((state) => ({ outlines: !state.outlines })),
    setOutlines: (outlines) => set({ outlines }),
    setHiddenIds: (ids) => set({ hiddenIds: [...new Set(ids)] }),
    toggleHidden: (id) =>
      set((state) => ({
        hiddenIds: state.hiddenIds.includes(id)
          ? state.hiddenIds.filter((hidden) => hidden !== id)
          : [...state.hiddenIds, id],
      })),
  }));
}
