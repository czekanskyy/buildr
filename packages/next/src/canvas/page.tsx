import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export interface BuildrCanvasPageProps {
  /**
   * Whether the caller may open the canvas (the editor's user session). Without a yes the answer is
   * the site's own 404, so the route does not reveal itself.
   */
  readonly authorize: () => boolean | Promise<boolean>;
  /**
   * The application's client file (`'use client'`) that mounts `CanvasRuntime` with its registry:
   * functions cannot cross the server-to-client boundary, so the registry is imported there.
   */
  readonly children: ReactNode;
}

/** The `metadata` of the canvas page: never indexed. */
export const canvasMetadata = { robots: { index: false, follow: false } } as const;

/**
 * The server wrapper of `/buildr/canvas` (docs/nextjs.md): checks the caller, opts the route into
 * dynamic rendering (never prerendered or cached) and renders `children` inside the site's own
 * layout, which is what gives the canvas full fidelity with the published page.
 */
export async function BuildrCanvasPage({ authorize, children }: BuildrCanvasPageProps) {
  // Reading request headers makes the route dynamic in Next 15 and 16.
  await headers();
  if (!(await authorize())) notFound();
  return <>{children}</>;
}
