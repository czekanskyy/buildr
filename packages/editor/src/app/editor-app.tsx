import type { DataContext, DataSchema, LocaleConfig, RegistryMeta } from '@buildr/core';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasFrame, type CanvasHost } from '../canvas-host/index.ts';
import { ClipboardProvider, useClipboardActions } from '../clipboard/index.ts';
import { MediaLibraryProvider } from '../dialogs/index.ts';
import {
  type DragHost,
  DragProvider,
  useDragEngine,
  useRegisterCanvas,
  useRegisterDragHost,
} from '../dnd/index.ts';
import { MessagesProvider, useT } from '../messages/index.tsx';
import {
  Breadcrumbs,
  InsertPanel,
  Inspector,
  InspectorDataProvider,
  IssuesPanel,
  LayersPanel,
  StyleInspector,
} from '../panels/index.ts';
import {
  createPersistence,
  type LoadedDocument,
  loadDocument,
  type PersistenceController,
  PersistenceProvider,
  useSaveAction,
} from '../persistence/index.ts';
import { usePreview } from '../preview/index.ts';
import { ShortcutProvider, useForwardedKeys } from '../shortcuts/index.ts';
import {
  createEditorStore,
  createLocaleStore,
  type EditorStore,
  EditorStoreProvider,
  LocaleProvider,
  type LocaleStore,
  useLocaleState,
} from '../store/index.ts';
import { LocaleSwitcher, PublishDialog, SamplePicker, Toolbar } from '../toolbar/index.ts';
import { Tabs } from '../ui/index.ts';
import { type BuilderEditorProps, type DocumentRef, resolveConfig } from './config.ts';
import { EditorLayout } from './layout.tsx';
import { ManifestProvider } from './manifest.tsx';

export interface EditorAppProps extends BuilderEditorProps {
  /** The registry the commands run against (`registry.meta` of the host's registry). */
  readonly registry: RegistryMeta;
  /** The languages the content can be written in; the session's (`getSession().locales`), else one language (`en`), when left out. */
  readonly locales?: LocaleConfig;
}

const SINGLE_LOCALE: LocaleConfig = {
  locales: ['en'],
  default: 'en',
  fallback: true,
  intl: { en: 'English' },
};

interface Ready {
  readonly loaded: LoadedDocument;
  readonly store: EditorStore;
  readonly persistence: PersistenceController;
  readonly canPublish: boolean;
  readonly localeStore: LocaleStore;
}

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | ({ readonly kind: 'ready' } & Ready);

/**
 * The whole editor (docs/editor.md#the-editor-app): loads the document of `documentRef` through
 * the adapter, creates its store and autosave, and composes the toolbar, the panels, the canvas
 * and the dialogs. `BuilderEditor` is the bare shell; hosts mount this one.
 */
export function EditorApp(props: EditorAppProps) {
  const config = useMemo(() => resolveConfig(props.config), [props.config]);
  const { adapter, documentRef, registry } = props;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const refKey = `${documentRef.collection}:${documentRef.id}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `documentRef` is identified by `refKey`
  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: 'loading' });
    void (async () => {
      try {
        const [loaded, session] = await Promise.all([
          loadDocument(adapter, documentRef),
          adapter.getSession(documentRef),
        ]);
        if (cancelled) return;
        const locales = props.locales ?? session.locales ?? SINGLE_LOCALE;
        const store = createEditorStore({
          doc: loaded.document,
          registry,
          readOnly: loaded.readOnly === true,
          locales,
        });
        const persistence = createPersistence({
          store,
          adapter,
          ref: documentRef,
          revision: loaded.revision,
          debounceMs: config.autosave.debounceMs,
          maxWaitMs: config.autosave.maxWaitMs,
        });
        setPhase({
          kind: 'ready',
          loaded,
          store,
          persistence,
          canPublish: session.canPublish,
          localeStore: createLocaleStore(locales),
        });
      } catch {
        if (!cancelled) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    adapter,
    refKey,
    registry,
    props.locales,
    config.autosave.debounceMs,
    config.autosave.maxWaitMs,
  ]);

  return (
    <MessagesProvider locale={config.uiLocale}>
      <div
        className="buildr-editor"
        lang={config.uiLocale}
        {...(config.theme !== 'system' ? { 'data-theme': config.theme } : {})}
      >
        {phase.kind === 'ready' ? (
          <Session {...props} ready={phase} />
        ) : (
          <Status failed={phase.kind === 'error'} />
        )}
      </div>
    </MessagesProvider>
  );
}

function Status({ failed }: { readonly failed: boolean }) {
  const t = useT();
  return (
    <p className="bd-app-status" role={failed ? 'alert' : 'status'}>
      {t(failed ? 'app.error' : 'app.loading')}
    </p>
  );
}

function Session(props: EditorAppProps & { readonly ready: Ready }) {
  const { ready, adapter, manifest } = props;
  const config = useMemo(() => resolveConfig(props.config), [props.config]);
  return (
    <EditorStoreProvider store={ready.store}>
      <LocaleProvider store={ready.localeStore}>
        <ManifestProvider manifest={manifest}>
          <PersistenceProvider controller={ready.persistence}>
            <MediaLibraryProvider media={adapter.media}>
              <DragProvider>
                <ClipboardProvider>
                  <Keys overrides={config.shortcuts}>
                    <Shell {...props} />
                  </Keys>
                </ClipboardProvider>
              </DragProvider>
            </MediaLibraryProvider>
          </PersistenceProvider>
        </ManifestProvider>
      </LocaleProvider>
    </EditorStoreProvider>
  );
}

/** The shortcuts, with the actions the clipboard and the persistence provide. */
function Keys(props: {
  readonly overrides: Readonly<Record<string, string>>;
  readonly children: ReactNode;
}) {
  const clipboard = useClipboardActions();
  const save = useSaveAction();
  const actions = useMemo(() => ({ ...clipboard, save }), [clipboard, save]);
  return (
    <ShortcutProvider overrides={props.overrides} actions={actions}>
      {props.children}
    </ShortcutProvider>
  );
}

function useDataContext(adapter: EditorAppProps['adapter'], ref: DocumentRef) {
  const [schema, setSchema] = useState<DataSchema | undefined>();
  const [context, setContext] = useState<DataContext | undefined>();
  const key = `${ref.collection}:${ref.id}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ref` is identified by `key`
  useEffect(() => {
    let cancelled = false;
    void adapter.getDataSchema(ref).then(
      (next) => !cancelled && setSchema(next),
      () => undefined,
    );
    void adapter.getContext(ref).then(
      (next) => !cancelled && setContext(next),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [adapter, key]);
  return { schema, context };
}

function Shell(props: EditorAppProps & { readonly ready: Ready }) {
  const t = useT();
  const { adapter, documentRef, canvasUrl, manifest, ready } = props;
  const config = useMemo(() => resolveConfig(props.config), [props.config]);
  const locales = useLocaleState((state) => state.config);
  const locale = useLocaleState((state) => state.locale);
  const wireLocales = useMemo(
    () => ({ ...locales, locales: [...locales.locales], intl: { ...locales.intl } }),
    [locales],
  );
  const [host, setHost] = useState<CanvasHost | null>(null);
  const [breakpoint, setBreakpoint] = useState(config.breakpoints[0]?.id ?? 'desktop');
  const [publishOpen, setPublishOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<
    NonNullable<Parameters<typeof IssuesPanel>[0]['canvasDiagnostics']>
  >([]);
  const area = useRef<HTMLDivElement>(null);
  const engine = useDragEngine();
  const forward = useForwardedKeys();
  const data = useDataContext(adapter, documentRef);
  const preview = usePreview({ adapter, docRef: documentRef });

  useRegisterDragHost(host as DragHost | null);
  useRegisterCanvas(() => {
    const frame = area.current?.querySelector('iframe');
    if (frame === null || frame === undefined) return undefined;
    const box = frame.getBoundingClientRect();
    return {
      frame: { left: box.left, top: box.top, width: box.width, height: box.height },
      scale: frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1,
    };
  });

  useEffect(() => {
    if (host === null) return;
    return host.state.subscribe((state) => setDiagnostics(state.diagnostics as never));
  }, [host]);

  const changeBreakpoint = useCallback(
    (id: string) => {
      setBreakpoint(id);
      host?.setBreakpoint(id);
    },
    [host],
  );

  return (
    <>
      <EditorLayout
        toolbar={
          <>
            <Toolbar
              title={ready.loaded.title}
              breakpoints={config.breakpoints}
              breakpoint={breakpoint}
              onBreakpointChange={changeBreakpoint}
              cmsUrl={adapter.cmsUrl?.(documentRef)}
              onPreview={preview.preview}
              onPublish={() => setPublishOpen(true)}
              canPublish={ready.canPublish}
            />
            <LocaleSwitcher onChange={(next) => host?.setLocale(next)} />
            <SamplePicker
              adapter={adapter}
              docRef={documentRef}
              onChange={(contextRef) => host?.setContextRef(contextRef)}
            />
          </>
        }
        left={
          <Tabs
            label={t('editor.leftPanel')}
            items={[
              { value: 'insert', label: t('insert.title'), content: <InsertPanel /> },
              { value: 'layers', label: t('layers.title'), content: <LayersPanel /> },
            ]}
          />
        }
        center={
          <div className="bd-app-canvas" ref={area}>
            <CanvasFrame
              canvasUrl={canvasUrl}
              manifestHash={manifest.hash}
              locales={wireLocales}
              locale={locale}
              breakpoints={config.breakpoints}
              breakpoint={breakpoint}
              onHost={setHost}
              callbacks={{
                onKeyDown: (event) => {
                  forward({ key: event.key, mods: event.mods });
                },
                onDropTarget: (event) =>
                  engine.receiveTarget(event.target as never, event.reason as never),
              }}
            />
            <Breadcrumbs />
          </div>
        }
        right={
          <InspectorDataProvider schema={data.schema} context={data.context}>
            <Inspector
              locale={locale}
              defaultLocale={locales.default}
              renderStyle={(node) => <StyleInspector node={node} />}
            />
          </InspectorDataProvider>
        }
        issues={<IssuesPanel canvasDiagnostics={diagnostics} />}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        canvasDiagnostics={diagnostics}
      />
      {preview.overlay}
      {preview.error !== '' ? (
        <p className="bd-app-notice" role="status">
          {preview.error}
        </p>
      ) : null}
    </>
  );
}
