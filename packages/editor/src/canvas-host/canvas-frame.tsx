import { createParentTransport } from '@next-buildr/core/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BreakpointConfig } from '../app/config.ts';
import type { EmptyPageActions } from '../app/contracts.ts';
import { useManifest } from '../app/manifest.tsx';
import { interpolate, type MessageKey, useT } from '../messages/index.tsx';
import { useEditor, useEditorState } from '../store/index.ts';
import { useViewState } from '../store/react.tsx';
import { useTheme } from '../toolbar/theme.tsx';
import { Button, Icon } from '../ui/index.ts';
import { type CanvasHost, type CanvasHostOptions, createCanvasHost } from './host.ts';

export interface CanvasFrameProps {
  /** The canvas route (`@next-buildr/react/canvas` runs there). */
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
  /** The actions of the empty-page state; the buttons show only when it is given. */
  readonly emptyPage?: EmptyPageActions;
  readonly callbacks?: Pick<
    CanvasHostOptions,
    | 'onAction'
    | 'onInsert'
    | 'onKeyDown'
    | 'onContextMenu'
    | 'onNodeDoubleClick'
    | 'onDropTarget'
    | 'onCommandError'
    | 'onLocked'
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

export interface StageMetrics {
  /** The scale applied to the iframe. */
  readonly scale: number;
  /** The iframe's own (unscaled) CSS height: the visible height divided by the scale (0: unknown). */
  readonly frameHeight: number;
  /** The width the scaled page takes on the stage. */
  readonly stageWidth: number;
  /** The visible height of the stage (0: unknown). */
  readonly stageHeight: number;
}

/**
 * The stage arithmetic (A8): the frame is scaled with `transform`, which does not change its
 * layout box, so the frame's height is the visible height divided by the scale; the scaled
 * page then fills the visible stage exactly. `room` and `roomHeight` are the stage area in CSS
 * pixels (0 while not measured); with no height known the frame fills its parent.
 */
export function stageMetrics(input: {
  readonly width: number;
  readonly room: number;
  readonly roomHeight: number;
  readonly zoom: 'fit' | number;
}): StageMetrics {
  const { width, room, roomHeight, zoom } = input;
  const raw = zoom === 'fit' ? (room > 0 ? Math.min(1, room / width) : 1) : zoom;
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return {
    scale,
    frameHeight: roomHeight > 0 ? roomHeight / scale : 0,
    stageWidth: width * scale,
    stageHeight: roomHeight > 0 ? roomHeight : 0,
  };
}

const BREAKPOINT_LABELS: Readonly<Record<string, MessageKey>> = {
  desktop: 'toolbar.breakpoint.desktop',
  tablet: 'toolbar.breakpoint.tablet',
  mobile: 'toolbar.breakpoint.mobile',
};

const TYPE_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const MAX_TYPE_LABELS = 128;
const MAX_LABEL_UNITS = 40;
// Mirrors the protocol's label rule: plain text of 1-40 characters, no markup or control characters.
const UNSAFE = /[<>\p{C}\p{Zl}\p{Zp}]/u;

/**
 * At most 40 UTF-16 units, as the protocol's `.max(40)` counts, without splitting a surrogate pair
 * (cutting by code points would let ~21 astral characters through, and the canvas drops the message).
 */
export function cutLabel(label: string): string {
  let cut = '';
  for (const char of label) {
    if (cut.length + char.length > MAX_LABEL_UNITS) break;
    cut += char;
  }
  return cut;
}

/** The localized component names the canvas shows on its chip: only what the protocol accepts, at most 128. */
export function typeLabelsOf(
  components: Readonly<Record<string, { readonly label?: string | undefined }>> | undefined,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [type, meta] of Object.entries(components ?? {})) {
    if (Object.keys(labels).length >= MAX_TYPE_LABELS) break;
    const label = meta.label?.trim();
    if (
      label !== undefined &&
      label.length > 0 &&
      type.length <= 64 &&
      TYPE_ID.test(type) &&
      !UNSAFE.test(label)
    ) {
      labels[type] = cutLabel(label);
    }
  }
  return labels;
}

/**
 * The canvas iframe, its channel and its status screens. A "Reload canvas" button (or a fatal
 * error) mounts a new frame with a new session; nothing is lost, because the store holds the
 * state and the new canvas is initialized from it.
 */
export function CanvasFrame(props: CanvasFrameProps) {
  const t = useT();
  const store = useEditor();
  const view = useViewState();
  const theme = useTheme();
  const manifest = useManifest();
  const typeLabels = useMemo(() => typeLabelsOf(manifest?.components), [manifest]);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const resolvedTheme =
    theme?.attribute === 'dark' || (theme?.attribute === 'system' && systemDark) ? 'dark' : 'light';
  const empty = useEditorState((state) => {
    const root = state.doc.nodes[state.doc.root];
    return Object.values(root?.slots ?? {}).every((children) => children.length === 0);
  });
  const [attempt, setAttempt] = useState(0);
  const session = useMemo(() => {
    void attempt;
    return createSession();
  }, [attempt]);
  const source = useMemo(() => canvasSource(props.canvasUrl, session), [props.canvasUrl, session]);
  const iframe = useRef<HTMLIFrameElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<CanvasHost | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });

  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const frame = iframe.current;
    if (frame === null) return;
    const current = propsRef.current;
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
      onAction: (event) => propsRef.current.callbacks?.onAction?.(event),
      onInsert: (event) => propsRef.current.callbacks?.onInsert?.(event),
      onKeyDown: (event) => propsRef.current.callbacks?.onKeyDown?.(event),
      onContextMenu: (event) => propsRef.current.callbacks?.onContextMenu?.(event),
      onNodeDoubleClick: (event) => propsRef.current.callbacks?.onNodeDoubleClick?.(event),
      onDropTarget: (event) => propsRef.current.callbacks?.onDropTarget?.(event),
      onCommandError: (error) => propsRef.current.callbacks?.onCommandError?.(error),
      onLocked: (ids) => propsRef.current.callbacks?.onLocked?.(ids),
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
    host?.setView({
      outlines: view.outlines,
      hidden: [...view.hiddenIds],
      theme: resolvedTheme,
      typeLabels,
      labels: {
        toolbar: t('canvas.tools'),
        selectParent: t('canvas.parent'),
        selectParentOf: t('canvas.selectParentOf'),
        drag: t('canvas.drag'),
        moveUp: t('canvas.moveUp'),
        moveDown: t('canvas.moveDown'),
        duplicate: t('canvas.duplicate'),
        remove: t('canvas.delete'),
        align: t('canvas.align'),
        alignLeft: t('canvas.align.left'),
        alignCenter: t('canvas.align.center'),
        alignRight: t('canvas.align.right'),
        more: t('canvas.more'),
        insert: t('canvas.addHere'),
      },
    });
  }, [host, view.outlines, view.hiddenIds, resolvedTheme, typeLabels, t]);

  useEffect(() => {
    const element = wrap.current;
    if (element === null) return;
    const measure = () =>
      setRoom((prev) =>
        prev.width === element.clientWidth && prev.height === element.clientHeight
          ? prev
          : { width: element.clientWidth, height: element.clientHeight },
      );
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
  const metrics = stageMetrics({ width, room: room.width, roomHeight: room.height, zoom });
  const { scale } = metrics;
  useEffect(() => {
    host?.setView({ scale });
  }, [host, scale]);
  const breakpointId = hostState?.breakpoint ?? props.breakpoint;
  const breakpointKey = breakpointId === undefined ? undefined : BREAKPOINT_LABELS[breakpointId];
  // The same string as the toolbar's device readout, so the two never spell the width differently.
  const widthLabel = interpolate(t('toolbar.device.size'), {
    name: breakpointKey !== undefined ? t(breakpointKey) : (breakpointId ?? ''),
    width,
  });
  const status = hostState?.status ?? 'connecting';
  const error = hostState?.error;

  return (
    <div
      className="bd-canvas-host"
      ref={area}
      data-status={status}
      aria-busy={status === 'connecting' || status === 'initializing'}
    >
      <p className="bd-canvas-width bd-device-label">{widthLabel}</p>
      <div className="bd-canvas-stage-area" ref={wrap}>
        <div
          className="bd-canvas-stage"
          style={{
            width: metrics.stageWidth,
            ...(metrics.stageHeight > 0 ? { height: metrics.stageHeight } : {}),
          }}
        >
          <iframe
            ref={iframe}
            key={session}
            className="bd-canvas-frame"
            title={t('editor.canvas.frame')}
            src={source.src}
            data-status={status}
            style={{
              width,
              ...(metrics.frameHeight > 0 ? { height: metrics.frameHeight } : {}),
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>
      {status === 'connecting' || status === 'initializing' ? (
        <div className="bd-canvas-card bd-canvas-status" role="status">
          <Icon name="monitor-smartphone" size="md" />
          <p className="bd-canvas-title">{t('editor.canvas.connecting')}</p>
        </div>
      ) : null}
      {hostState?.connectionLost ? (
        <div className="bd-canvas-card bd-canvas-error" role="alert">
          {t('canvas.connectionLost')}
        </div>
      ) : null}
      {status === 'ready' && empty ? (
        <div className="bd-canvas-card bd-canvas-status bd-canvas-empty" role="status">
          <Icon name="monitor-smartphone" size="md" />
          <p className="bd-canvas-title">{t('editor.canvas.empty')}</p>
          {props.emptyPage !== undefined ? (
            <div className="bd-canvas-actions">
              <Button variant="primary" onClick={() => props.emptyPage?.onAddBlock()}>
                {t('canvas.empty.add')}
              </Button>
              <Button onClick={() => props.emptyPage?.onPickPattern()}>
                {t('canvas.empty.pattern')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {status === 'error' && error !== undefined ? (
        <div className="bd-canvas-card bd-canvas-error" role="alert">
          <Icon name="triangle-alert" size="md" />
          <p className="bd-canvas-title">{t('editor.canvas.error.title')}</p>
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
