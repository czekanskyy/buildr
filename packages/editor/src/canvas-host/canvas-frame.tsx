import { createParentTransport } from '@buildr/core/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BreakpointConfig } from '../app/config.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { useEditor } from '../store/index.ts';
import { Button } from '../ui/index.ts';
import { type CanvasHost, type CanvasHostOptions, createCanvasHost } from './host.ts';

export interface CanvasFrameProps {
  /** The canvas route (`@buildr/react/canvas` runs there). */
  readonly canvasUrl: string;
  /** `RegistryManifest.hash` of the registry the editor knows. */
  readonly manifestHash: string;
  readonly locales: CanvasHostOptions['locales'];
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint?: string;
  readonly locale?: string;
  readonly contextRef?: string | null;
  readonly handshakeTimeoutMs?: number;
  /** Gets the host once the frame is mounted (and `null` when it goes), for the toolbar and the drag-and-drop engine. */
  readonly onHost?: (host: CanvasHost | null) => void;
  readonly callbacks?: Pick<
    CanvasHostOptions,
    'onKeyDown' | 'onContextMenu' | 'onNodeDoubleClick' | 'onDropTarget' | 'onCommandError'
  >;
}

/** A random nonce for the canvas URL: 32 hex characters, unguessable by the page in the frame's neighbours. */
export function createSession(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The canvas URL with the session in it, and the one origin it is served from. */
export function canvasSource(canvasUrl: string, session: string): { src: string; origin: string } {
  const url = new URL(canvasUrl, globalThis.location?.href);
  url.searchParams.set('session', session);
  return { src: url.toString(), origin: url.origin };
}

/**
 * The canvas iframe, its channel and its status screens. A "Reload canvas" button (or a fatal
 * error) mounts a new frame with a new session; nothing is lost, because the store holds the
 * state and the new canvas is initialized from it.
 */
export function CanvasFrame(props: CanvasFrameProps) {
  const t = useT();
  const store = useEditor();
  const [attempt, setAttempt] = useState(0);
  const session = useMemo(() => {
    void attempt;
    return createSession();
  }, [attempt]);
  const source = useMemo(() => canvasSource(props.canvasUrl, session), [props.canvasUrl, session]);
  const iframe = useRef<HTMLIFrameElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<CanvasHost | null>(null);
  const [room, setRoom] = useState(0);

  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const frame = iframe.current;
    if (frame === null) return;
    const current = propsRef.current;
    // biome-ignore lint/style/useConst: assigned below, read by the transport's callback
    let created: CanvasHost | undefined;
    const transport = createParentTransport({
      iframe: frame,
      canvasOrigin: source.origin,
      session,
      onReject: (rejection) => created?.handleReject(rejection),
    });
    created = createCanvasHost({
      store,
      transport,
      manifestHash: current.manifestHash,
      locales: current.locales,
      breakpoints: current.breakpoints,
      ...(current.breakpoint !== undefined ? { breakpoint: current.breakpoint } : {}),
      ...(current.locale !== undefined ? { locale: current.locale } : {}),
      ...(current.contextRef !== undefined ? { contextRef: current.contextRef } : {}),
      ...(current.handshakeTimeoutMs !== undefined
        ? { handshakeTimeoutMs: current.handshakeTimeoutMs }
        : {}),
      onKeyDown: (event) => propsRef.current.callbacks?.onKeyDown?.(event),
      onContextMenu: (event) => propsRef.current.callbacks?.onContextMenu?.(event),
      onNodeDoubleClick: (event) => propsRef.current.callbacks?.onNodeDoubleClick?.(event),
      onDropTarget: (event) => propsRef.current.callbacks?.onDropTarget?.(event),
      onCommandError: (error) => propsRef.current.callbacks?.onCommandError?.(error),
    });
    setHost(created);
    propsRef.current.onHost?.(created);
    return () => {
      created?.destroy();
      propsRef.current.onHost?.(null);
      setHost(null);
    };
  }, [store, session, source.origin]);

  useEffect(() => {
    const element = area.current;
    if (element === null) return;
    const measure = () => setRoom(element.clientWidth);
    measure();
    const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer === undefined) return;
    const observer = new Observer(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hostState = useHostState(host);
  const width = hostState?.width ?? props.breakpoints[0]?.width ?? 1280;
  const zoom = hostState?.zoom ?? 'fit';
  const scale = zoom === 'fit' ? (room > 0 ? Math.min(1, room / width) : 1) : zoom;
  const status = hostState?.status ?? 'connecting';
  const error = hostState?.error;

  return (
    <div className="bd-canvas-host" ref={area} data-status={status}>
      <div className="bd-canvas-stage" style={{ width: width * scale }}>
        <iframe
          ref={iframe}
          key={session}
          className="bd-canvas-frame"
          title={t('editor.canvas.frame')}
          src={source.src}
          data-status={status}
          style={{ width, transform: `scale(${scale})` }}
        />
      </div>
      {status === 'connecting' ? (
        <p className="bd-canvas-status" role="status">
          {t('editor.canvas.connecting')}
        </p>
      ) : null}
      {status === 'error' && error !== undefined ? (
        <div className="bd-canvas-error" role="alert">
          <p>{t(`editor.canvas.error.${error.kind}` satisfies MessageKey)}</p>
          {error.kind === 'canvas' ? <p className="bd-canvas-detail">{error.message}</p> : null}
          {error.details !== undefined ? (
            <dl className="bd-canvas-detail">
              {Object.entries(error.details).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Button onClick={() => setAttempt((n) => n + 1)}>{t('editor.canvas.reload')}</Button>
        </div>
      ) : null}
    </div>
  );
}

function useHostState(host: CanvasHost | null) {
  const [, force] = useState(0);
  useEffect(() => {
    if (host === null) return;
    return host.state.subscribe(() => force((n) => n + 1));
  }, [host]);
  return host?.state.getState();
}
