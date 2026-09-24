'use client';

import { Component, type ReactNode } from 'react';

export interface BuildrSectionBoundaryProps {
  readonly children?: ReactNode;
  /** Shown instead of the section that failed; nothing by default. */
  readonly fallback?: ReactNode;
}

/**
 * Keeps one broken top-level section from taking the whole page down (docs/nextjs.md#server-components-client-boundaries-dynamic-routes).
 * The failure is logged to the console; a server-side `onError` runs where the page is rendered.
 */
export class BuildrSectionBoundary extends Component<
  BuildrSectionBoundaryProps,
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('[buildr] a section failed to render', error);
  }

  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
