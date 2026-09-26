import type { DataContext, DataSchema } from '@next-buildr/core';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

interface InspectorData {
  /** The shape of the data a binding can read; without it paths are typed by hand and not checked. */
  readonly schema: DataSchema | undefined;
  /** Sample data for the live preview (PB-090 lets the author pick it); without it there is no preview. */
  readonly context: DataContext | undefined;
}

const NONE: InspectorData = { schema: undefined, context: undefined };
const DataCtx = createContext<InspectorData>(NONE);

export interface InspectorDataProviderProps {
  readonly schema?: DataSchema | undefined;
  readonly context?: DataContext | undefined;
  readonly children: ReactNode;
}

/** What the value editors of the inspector know about the data: its schema and a sample of it. */
export function InspectorDataProvider({ schema, context, children }: InspectorDataProviderProps) {
  const value = useMemo(() => ({ schema, context }), [schema, context]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useInspectorData = (): InspectorData => useContext(DataCtx);
