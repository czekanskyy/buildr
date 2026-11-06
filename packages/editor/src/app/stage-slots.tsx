import { createContext, useContext } from 'react';
import type { StageSlots } from './contracts.ts';

/**
 * The stage element and the issues drawer state. `EditorLayout` provides it; toasts and the issues
 * drawer read it to portal into the stage. Without a provider (a panel rendered on its own) the
 * consumers fall back to their previous placement.
 */
export const StageSlotsContext = createContext<StageSlots | undefined>(undefined);

export function useStageSlots(): StageSlots | undefined {
  return useContext(StageSlotsContext);
}
