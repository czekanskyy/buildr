'use client';

import {
  type CompileCache,
  compileStyles,
  type DataContext,
  type DataSource,
  type Diagnostic,
  type NodeId,
  type PreparedData,
  prepareRender,
  type Theme,
} from '@buildr/core';
import { createChildTransport, MAX_DIAGNOSTICS, PROTOCOL_VERSION } from '@buildr/core/protocol';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactRegistry } from '../define/registry.ts';
import type { Platform } from '../define/types.ts';
import { loadDocument } from '../render/pipeline.ts';
import { BuildrStyles } from '../render/styles.tsx';
import type { CanvasInstrumentation, ResumeState } from '../render/types.ts';
import { installInlineEdit } from './inline-edit.ts';
import { installInteractions } from './interactions.ts';
import { type CanvasEnv, CanvasEnvContext, NodeView } from './node-view.tsx';
import { createOverlay } from './overlay/overlay.ts';
import { type CanvasStore, createCanvasStore } from './store.ts';
import type { CanvasTransport } from './types.ts';

export type { CanvasTransport };

export interface CanvasRuntimeProps {
  readonly registry: ReactRegistry;
  readonly theme: Theme;
  readonly platform: Platform;
  /** Where media and queries come from; without it the canvas renders without them. */
  readonly dataSource?: DataSource;
  /** The origins an editor may be served from. Not needed when `connect` is given. */
  readonly allowedOrigins?: readonly string[];
  /** The nonce of the session, from the canvas URL (`?session=`) unless given. */
  readonly session?: string;
  /** Identifies the component set the editor's palette was built from, so it can tell when it is stale. */
  readonly manifestHash: string;
  readonly rendererVersion: string;
  readonly messages?: Readonly<Record<string, string>>;
  readonly cache?: CompileCache;
  /**
   * Opens the channel to the editor. It is called when the runtime mounts and the channel is closed
   * when it unmounts (so it works under `StrictMode`); by default a `createChildTransport` on the
   * canvas's own window. A test passes a fake.
   */
  readonly connect?: () => CanvasTransport;
  /** How often `canvas:hello` is repeated while the editor has not answered, in ms. */
  readonly helloIntervalMs?: number;
  /** How many times `canvas:hello` is sent before the runtime gives up. */
  readonly helloAttempts?: number;
  /** Where uncaught errors are listened for; the canvas's own window by default. */
  readonly errorTarget?: ErrorTargetLike | null;
  /** Whether the canvas captures clicks and hover and draws the selection overlay; on by default. */
  readonly interactive?: boolean;
  /** Called with the store, once, so an overlay or a test can read the same state. */
  readonly onStore?: (store: CanvasStore) => void;
}

/** `addEventListener` for `error` and `unhandledrejection`, without the DOM types. */
export interface ErrorTargetLike {
  addEventListener(type: 'error' | 'unhandledrejection', listener: (event: never) => void): void;
  removeEventListener(type: 'error' | 'unhandledrejection', listener: (event: never) => void): void;
}

const NO_DATA: PreparedData = { media: {}, queries: {}, collectionsUsed: [], diagnostics: [] };

function sessionFromUrl(): string {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  return new URLSearchParams(search).get('session') ?? '';
}

function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 2000);
}

function describeReason(event: unknown): string {
  const e = event as { message?: unknown; reason?: unknown };
  if (typeof e.message === 'string' && e.message !== '') return e.message.slice(0, 2000);
  return messageOf(e.reason);
}

/** A diagnostic in the shape the protocol allows, whatever it carries. */
function toWire(d: Diagnostic) {
  return {
    code: d.code.slice(0, 128) || 'unknown',
    message: d.message.slice(0, 2000),
    severity: d.severity,
    ...(d.path !== undefined ? { path: [...d.path.slice(0, 32)] } : {}),
    ...(d.details !== undefined ? { details: { ...d.details } } : {}),
  };
}

/**
 * The canvas: the page the editor puts in its iframe (docs/editor.md#the-canvas). It keeps a
 * replica of the editor's document, applies the patches the editor sends, and renders it with the
 * same shared renderer as the site, one node at a time (so editing one prop re-renders one node).
 * It sends `canvas:hello` until the editor answers with `editor:init`, then `canvas:ready`, asks
 * for the document again (`doc:resync-request`) when it misses a version, and reports what it
 * meets while rendering as `diagnostics` and `canvas:error`.
 */
export function CanvasRuntime(props: CanvasRuntimeProps) {
  const { registry, theme, platform, dataSource, cache, messages } = props;

  const [store] = useState(() => createCanvasStore());
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const transportRef = useRef<CanvasTransport | null>(null);
  const [generation, setGeneration] = useState(0);
  const generationRef = useRef(0);
  const [prepared, setPrepared] = useState<
    { generation: number; data: PreparedData } | undefined
  >();
  const readyFor = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    propsRef.current.onStore?.(store);
  }, [store]);

  const bump = useCallback(() => {
    generationRef.current += 1;
    setGeneration(generationRef.current);
  }, []);

  // The channel: handlers first, then the handshake.
  useEffect(() => {
    const { connect, helloIntervalMs = 500, helloAttempts = 40 } = propsRef.current;
    const transport =
      connect?.() ??
      createChildTransport({
        allowedOrigins: propsRef.current.allowedOrigins ?? [],
        session: propsRef.current.session ?? sessionFromUrl(),
      });
    transportRef.current = transport;
    let resyncing = false;
    let inited = false;

    const fail = (message: string, fatal: boolean, nodeId?: NodeId) => {
      transport.send('canvas:error', {
        message,
        fatal,
        ...(nodeId !== undefined ? { nodeId } : {}),
      });
    };
    const load = (input: unknown, fatal: boolean) => {
      const loaded = loadDocument(input, propsRef.current.registry);
      store.setDiagnostics('load', loaded.diagnostics);
      if (loaded.doc === undefined) {
        fail(loaded.diagnostics[0]?.message ?? 'the document cannot be rendered', fatal);
      }
      return loaded.doc;
    };

    const offs = [
      transport.on('editor:init', (p) => {
        const doc = load(p.doc, true);
        if (doc === undefined) return;
        inited = true;
        resyncing = false;
        store.init({
          doc,
          version: p.docVersion,
          selection: p.selection,
          hover: null,
          viewport: p.viewport,
          mode: p.mode,
          locale: p.locale,
          locales: p.locales,
          contextRef: p.contextRef,
        });
        bump();
      }),
      transport.on('doc:set', (p) => {
        const doc = load(p.doc, false);
        if (doc === undefined) return;
        resyncing = false;
        store.setDocument(doc, p.docVersion);
        bump();
      }),
      transport.on('doc:patch', (p) => {
        if (!inited) return;
        const outcome = store.applyPatches(p.from, p.to, p.patches);
        if ((outcome === 'gap' || outcome === 'invalid') && !resyncing) {
          resyncing = true;
          transport.send('doc:resync-request', { have: store.getState().version });
        }
      }),
      transport.on('selection:set', (p) => store.update({ selection: p.ids })),
      transport.on('hover:set', (p) => store.update({ hover: p.id })),
      transport.on('viewport:set', (p) => store.update({ viewport: p })),
      transport.on('mode:set', (p) => store.update({ mode: p.mode })),
      transport.on('context:set', (p) => {
        store.update({ contextRef: p.contextRef });
        bump();
      }),
      transport.on('locale:set', (p) => {
        store.update({ locale: p.locale });
        bump();
      }),
    ];

    const sendHello = () =>
      transport.send('canvas:hello', {
        protocol: PROTOCOL_VERSION,
        rendererVersion: propsRef.current.rendererVersion,
        manifestHash: propsRef.current.manifestHash,
      });
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hello = () => {
      if (inited || attempts >= helloAttempts) return;
      attempts += 1;
      sendHello();
      timer = setTimeout(hello, helloIntervalMs);
    };
    hello();

    const target =
      propsRef.current.errorTarget === undefined
        ? ((globalThis as { window?: ErrorTargetLike }).window ?? null)
        : propsRef.current.errorTarget;
    const onError = (event: never) => fail(describeReason(event), false);
    target?.addEventListener('error', onError);
    target?.addEventListener('unhandledrejection', onError);

    return () => {
      clearTimeout(timer);
      target?.removeEventListener('error', onError);
      target?.removeEventListener('unhandledrejection', onError);
      for (const off of offs) off();
      transport.close();
      transportRef.current = null;
    };
  }, [store, bump]);

  // Selection, hover and the overlay: they need a page, so a server render skips them.
  const interactive = props.interactive ?? true;
  useEffect(() => {
    const doc = (globalThis as { document?: Document }).document;
    if (!interactive || doc === undefined) return;
    const transport = () => transportRef.current;
    // Inline editing first: its double click listener must run before the capture one stops it.
    const stopInline = installInlineEdit({
      document: doc,
      store,
      transport,
      inlineProp: (type) => propsRef.current.registry.meta.get(type)?.editor?.inlineProp,
    });
    const stop = installInteractions({ document: doc, store, transport });
    const overlay = createOverlay({ document: doc, store });
    return () => {
      stop();
      stopInline();
      overlay.destroy();
    };
  }, [store, interactive]);

  // Diagnostics: coalesced, so a render that reports from many nodes sends one message.
  useEffect(() => {
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    let last = '';
    const flush = () => {
      scheduled = undefined;
      const items = store.getDiagnostics().slice(0, MAX_DIAGNOSTICS).map(toWire);
      const json = JSON.stringify(items);
      if (json === last) return;
      last = json;
      transportRef.current?.send('diagnostics', { items });
    };
    const off = store.subscribeDiagnostics(() => {
      scheduled ??= setTimeout(flush, 0);
    });
    return () => {
      off();
      clearTimeout(scheduled);
    };
  }, [store]);

  const context = useMemo<DataContext>(
    () => ({
      scopes: {},
      locale: state.locale,
      locales: state.locales ?? { default: state.locale, fallback: false, intl: {} },
      timeZone: 'UTC',
      mode: 'canvas',
    }),
    [state.locale, state.locales],
  );

  // Media and queries, prepared again when the document is replaced or the context changes; a
  // patch does not re-run it (the data of a single edit is PB-071's business).
  useEffect(() => {
    const doc = store.getState().doc;
    if (doc === undefined) return;
    if (dataSource === undefined) {
      setPrepared({ generation, data: NO_DATA });
      return;
    }
    let cancelled = false;
    prepareRender(doc, registry.meta, context, dataSource, cache !== undefined ? { cache } : {})
      .then((data) => {
        if (!cancelled) {
          store.setDiagnostics('data', data.diagnostics);
          setPrepared({ generation, data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          store.setDiagnostics('data', [
            { code: 'canvas.data-failed', message: messageOf(error), severity: 'error' },
          ]);
          setPrepared({ generation, data: NO_DATA });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [generation, context, dataSource, registry, cache, store]);

  // The editor is told the canvas is ready once, after the first commit that has data for it.
  useEffect(() => {
    if (prepared === undefined || state.initCount === 0) return;
    if (prepared.generation !== generationRef.current || readyFor.current === state.initCount) {
      return;
    }
    readyFor.current = state.initCount;
    transportRef.current?.send('canvas:ready', {});
  }, [prepared, state.initCount]);

  const instrument = useMemo<CanvasInstrumentation>(() => {
    const edit = state.mode === 'edit';
    return {
      rootAttributes: (node) => ({ 'data-bid': node.id }),
      lazyChild: (node, resume: ResumeState) => (
        <NodeView key={`${node.id}@${resume.instance.join('.')}`} id={node.id} resume={resume} />
      ),
      unknownComponent: (node) => (
        <div data-bid={node.id} data-buildr-placeholder="unknown" role="note">
          {node.type}
        </div>
      ),
      emptySlot: (node, slot) => {
        if (!edit) return null;
        const text = registry.meta.get(node.type)?.editor?.emptySlotText?.[slot];
        return (
          <div data-buildr-placeholder="empty-slot" data-buildr-slot={slot}>
            {text ?? ''}
          </div>
        );
      },
    };
  }, [registry, state.mode]);

  const onNodeError = useMemo(
    () => (id: NodeId, error: unknown) => {
      transportRef.current?.send('canvas:error', {
        message: messageOf(error),
        nodeId: id,
        fatal: false,
      });
    },
    [],
  );

  const data = prepared?.data;
  const env = useMemo<CanvasEnv | undefined>(
    () =>
      data === undefined
        ? undefined
        : {
            store,
            registry,
            data,
            platform,
            instrument,
            onNodeError,
            ...(messages !== undefined ? { messages } : {}),
            ...(cache !== undefined ? { cache } : {}),
          },
    [store, registry, data, platform, instrument, onNodeError, messages, cache],
  );

  const doc = state.doc;
  const styles = useMemo(
    () => (doc === undefined ? undefined : compileStyles(doc, theme)),
    [doc, theme],
  );
  const resume = useMemo<ResumeState>(
    () => ({ context, instance: [], parents: [], path: [] }),
    [context],
  );

  useEffect(() => {
    if (styles !== undefined) store.setDiagnostics('styles', styles.diagnostics);
  }, [store, styles]);

  if (doc === undefined || env === undefined || styles === undefined) return null;
  const rootView: ReactNode = <NodeView id={doc.root} resume={resume} />;
  return (
    <CanvasEnvContext.Provider value={env}>
      <BuildrStyles styles={styles} theme={theme} />
      {rootView}
    </CanvasEnvContext.Provider>
  );
}
