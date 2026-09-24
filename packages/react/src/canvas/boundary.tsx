'use client';

import type { NodeId } from '@buildr/core';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface NodeBoundaryProps {
  readonly nodeId: NodeId;
  /** Changes whenever the node does: an author who fixed the props gets the component back. */
  readonly resetKey: unknown;
  /** Tells the editor, which lists the error and leaves the rest of the page alone. */
  readonly onError: (nodeId: NodeId, error: unknown) => void;
  readonly children: ReactNode;
}

interface State {
  readonly error: unknown;
  readonly resetKey: unknown;
}

/**
 * One node's error boundary. A component that throws while rendering must not take the page with
 * it: it is replaced by a placeholder that keeps the node's `data-bid`, so it can still be
 * selected and deleted, and the error is reported as a non-fatal `canvas:error`.
 */
export class NodeBoundary extends Component<NodeBoundaryProps, State> {
  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('unknown error') };
  }

  static getDerivedStateFromProps(props: NodeBoundaryProps, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey
      ? null
      : { error: undefined, resetKey: props.resetKey };
  }

  override state: State = { error: undefined, resetKey: this.props.resetKey };

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(this.props.nodeId, error);
  }

  override render(): ReactNode {
    if (this.state.error === undefined) return this.props.children;
    const message = this.state.error instanceof Error ? this.state.error.message : 'render error';
    return (
      <div
        data-bid={this.props.nodeId}
        data-buildr-placeholder="error"
        role="alert"
        style={{ outline: '1px dashed currentColor', padding: '0.5rem', font: 'inherit' }}
      >
        {message}
      </div>
    );
  }
}
