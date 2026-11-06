import type {
  ComponentMigrations,
  DataContext,
  DataSchema,
  LocaleConfig,
  RegistryMeta,
} from '@next-buildr/core';
import { authorCodeEnabled, createIndex, type NodeId } from '@next-buildr/core';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CanvasFrame, type CanvasHost } from '../canvas-host/index.ts';
import { ClipboardProvider, useClipboardActions } from '../clipboard/index.ts';
import { MediaLibraryProvider, RemoveConfirm } from '../dialogs/index.ts';
import {
  type DragHost,
  DragProvider,
  useDragEngine,
  useRegisterCanvas,
  useRegisterDragHost,
} from '../dnd/index.ts';
import { interpolate, MessagesProvider, usePlural, useT } from '../messages/index.tsx';
import {
  Breadcrumbs,
  countIssues,
  InsertPanel,
  Inspector,
  InspectorDataProvider,
  InspectorRail,
  type InspectorTab,
  IssuesPanel,
  LayersPanel,
  LeftPanel,
  SectionsToggle,
  StyleInspector,
  StyleSectionsProvider,
  useIssues,
} from '../panels/index.ts';
import {
  createPersistence,
  type LoadedDocument,
  loadDocument,
  type PersistenceController,
  PersistenceProvider,
  useSaveAction,
} from '../persistence/index.ts';
import { isSafePreviewUrl, usePreview } from '../preview/index.ts';
import { ShortcutProvider, useForwardedKeys } from '../shortcuts/index.ts';
import { hasDescendants } from '../shortcuts/navigation.ts';
import {
  createEditorStore,
  createLocaleStore,
  type EditorStore,
  EditorStoreProvider,
  isNodeStructureLocked,
  LocaleProvider,
  type LocaleStore,
  structureLockedIds,
  useEditor,
  useEditorState,
  useLocaleState,
} from '../store/index.ts';
import { useViewState } from '../store/react.tsx';
import { PublishDialog, ThemeProvider, Toolbar, useThemePreference } from '../toolbar/index.ts';
import {
  Icon,
  PortalContainerProvider,
  ToastProvider,
  useStructureLockedNotice,
  useToast,
} from '../ui/index.ts';
import { type BuilderEditorProps, type DocumentRef, resolveConfig } from './config.ts';
import type { DeviceShortcutKey, LeftPanelTab, PaletteMode, RemoveRequest } from './contracts.ts';
import { EditorLayout } from './layout.tsx';
import { componentMeta, ManifestProvider } from './manifest.tsx';
import { type ShellPanels, useShellPanels } from './shell-panels.tsx';
import { SmallScreenNotice, useViewportTooNarrow } from './small-screen.tsx';
import { StatusInfo } from './status-info.tsx';

export interface EditorAppProps extends BuilderEditorProps {
  /** The registry the commands run against (`registry.meta` of the host's registry). */
  readonly registry: RegistryMeta;
  /** The languages the content can be written in; the session's (`getSession().locales`), else one language (`en`), when left out. */
  readonly locales?: LocaleConfig;
  /** `registry.migrations` of the host's registry: lets a paste of content copied under older component versions (or retired types) migrate instead of being refused. */
  readonly migrations?: ComponentMigrations;
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
  // The host's `config.theme` wins; otherwise the author's remembered light / dark / system choice.
  const theme = useThemePreference(config.theme);
  // Menus, popovers and dialogs render inside the root, so they inherit its `data-theme`.
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // A window too narrow to edit in keeps the editor from opening (nothing is loaded); one that is
  // already open stays open when the window shrinks, so no work is torn down.
  const narrow = useViewportTooNarrow(config.minViewportWidth);
  // `undefined`: not measured yet (server render, hydration) - show the loading state, load nothing.
  const blocked = narrow === true && phase.kind !== 'ready';
  const waiting = narrow === undefined && phase.kind !== 'ready';
  const refKey = `${documentRef.collection}:${documentRef.id}`;
  // The host's `canUnlock` is read at the moment of an unlock, so a new function never reloads the editor.
  const canUnlockRef = useRef(props.canUnlock);
  canUnlockRef.current = props.canUnlock;
  const hasCanUnlock = props.canUnlock !== undefined;
  // ADR-026: only an explicit `true` permits author code; the prop wins over `config.capabilities`.
  const authorCode = authorCodeEnabled(props.capabilities ?? config.capabilities);
  const unlockFromHost = useCallback<NonNullable<BuilderEditorProps['canUnlock']>>(
    (request) => canUnlockRef.current?.(request) === true,
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `documentRef` is identified by `refKey`
  useEffect(() => {
    if (blocked || waiting) return;
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
          ...(hasCanUnlock ? { canUnlock: unlockFromHost } : {}),
          ...(authorCode ? { capabilities: { authorCode: true } } : {}),
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
    blocked,
    waiting,
    config.autosave.debounceMs,
    config.autosave.maxWaitMs,
    hasCanUnlock,
    unlockFromHost,
    authorCode,
  ]);

  return (
    <MessagesProvider locale={config.uiLocale}>
      <ThemeProvider value={theme}>
        <PortalContainerProvider container={root}>
          <div
            ref={setRoot}
            className="buildr-editor"
            lang={config.uiLocale}
            {...(theme.attribute !== 'system' ? { 'data-theme': theme.attribute } : {})}
          >
            {blocked ? (
              <SmallScreenNotice />
            ) : phase.kind === 'ready' ? (
              <Session {...props} ready={phase} />
            ) : (
              <Status failed={!waiting && phase.kind === 'error'} />
            )}
          </div>
        </PortalContainerProvider>
      </ThemeProvider>
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
  const bridge = useRef<Bridge>({});
  return (
    <ToastProvider>
      <EditorStoreProvider store={ready.store}>
        <LocaleProvider store={ready.localeStore}>
          <ManifestProvider manifest={manifest}>
            <PersistenceProvider controller={ready.persistence}>
              <MediaLibraryProvider media={adapter.media}>
                <DragProvider>
                  <ClipboardProvider migrations={props.migrations}>
                    <Keys overrides={config.shortcuts} bridge={bridge}>
                      <Shell {...props} bridge={bridge} />
                    </Keys>
                  </ClipboardProvider>
                </DragProvider>
              </MediaLibraryProvider>
            </PersistenceProvider>
          </ManifestProvider>
        </LocaleProvider>
      </EditorStoreProvider>
    </ToastProvider>
  );
}

/**
 * What the shell registers for the shortcuts: the provider sits above the shell (the clipboard and
 * the persistence need it), the panels and the removal flow below, so the keys reach them here.
 */
interface Bridge {
  setDevice?: (key: DeviceShortcutKey) => void;
  togglePanels?: () => void;
  focusBlockSearch?: () => void;
  onRemove?: (request: RemoveRequest) => void;
}

/** The shortcuts, with the actions the clipboard and the persistence provide. */
function Keys(props: {
  readonly overrides: Readonly<Record<string, string>>;
  readonly bridge: RefObject<Bridge>;
  readonly children: ReactNode;
}) {
  const clipboard = useClipboardActions();
  const save = useSaveAction();
  const actions = useMemo(() => ({ ...clipboard, save }), [clipboard, save]);
  const { bridge } = props;
  const callbacks = useMemo(
    () => ({
      setDevice: (key: DeviceShortcutKey) => bridge.current.setDevice?.(key),
      togglePanels: () => bridge.current.togglePanels?.(),
      focusBlockSearch: () => bridge.current.focusBlockSearch?.(),
    }),
    [bridge],
  );
  const onRemove = useCallback(
    (request: RemoveRequest) => bridge.current.onRemove?.(request),
    [bridge],
  );
  return (
    <ShortcutProvider
      overrides={props.overrides}
      actions={actions}
      callbacks={callbacks}
      onRemove={onRemove}
    >
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

/** A link an adapter may offer beyond the contract (`historyUrl`, `helpUrl`); `undefined` when it does not. */
function optionalUrl(
  adapter: object,
  name: 'historyUrl' | 'helpUrl',
  ref: DocumentRef,
): string | undefined {
  const read = (adapter as Partial<Record<typeof name, (ref: DocumentRef) => string | undefined>>)[
    name
  ];
  return typeof read === 'function' ? read.call(adapter, ref) : undefined;
}

/** The page's public address as it shows in the publish dialog: the adapter's non-draft preview URL, when it is a safe one. */
function publicAddress(adapter: EditorAppProps['adapter'], ref: DocumentRef): string | undefined {
  try {
    const url = adapter.previewUrl(ref, { draft: false });
    if (!isSafePreviewUrl(url)) return undefined;
    const parsed = new URL(url, window.location.href);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

/** Hands the shell's panel controls (collapse, tab) to the shell component above the layout. */
function PanelsTap({ into }: { readonly into: RefObject<ShellPanels | undefined> }) {
  into.current = useShellPanels();
  return null;
}

/** Brings the left panel into view on a tab: out of its rail, or open as an overlay when narrow. */
function revealLeft(panels: ShellPanels | undefined, tab: LeftPanelTab) {
  if (panels === undefined) return;
  panels.setLeftTab?.(tab);
  if (panels.narrow) {
    if (!panels.open.left) panels.toggle('left');
  } else if (panels.collapsed?.left === true) {
    panels.toggleCollapsed?.('left');
  }
}

interface LeftColumnProps {
  readonly mode: PaletteMode;
  readonly onModeChange: (mode: PaletteMode) => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  readonly onRemoveRequest: (request: RemoveRequest) => void;
}

function LeftColumn({ mode, onModeChange, searchRef, onRemoveRequest }: LeftColumnProps) {
  const panels = useShellPanels();
  return (
    <LeftPanel
      tab={panels?.leftTab ?? 'blocks'}
      onTabChange={(next) => panels?.setLeftTab?.(next)}
      onCollapse={() =>
        panels?.narrow ? panels.toggle('left') : panels?.toggleCollapsed?.('left')
      }
      blocks={<InsertPanel mode={mode} onModeChange={onModeChange} searchRef={searchRef} />}
      structure={<LayersPanel onRemoveRequest={onRemoveRequest} />}
    />
  );
}

function RightRail(props: {
  readonly tab: InspectorTab;
  readonly onTabChange: (tab: InspectorTab) => void;
}) {
  const panels = useShellPanels();
  return (
    <InspectorRail
      tab={props.tab}
      onTabChange={props.onTabChange}
      onExpand={() => panels?.toggleCollapsed?.('right')}
    />
  );
}

function Shell(
  props: EditorAppProps & { readonly ready: Ready; readonly bridge: RefObject<Bridge> },
) {
  const t = useT();
  const plural = usePlural();
  const view = useViewState();
  const [canvasMenu, setCanvasMenu] = useState<{ id: NodeId; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<NodeId | null>(null);
  const canvasMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvasMenu) return;
    canvasMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !canvasMenuRef.current?.contains(event.target))
        setCanvasMenu(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [canvasMenu]);
  const { adapter, documentRef, canvasUrl, manifest, ready, bridge } = props;
  const config = useMemo(() => resolveConfig(props.config), [props.config]);
  const locales = useLocaleState((state) => state.config);
  const locale = useLocaleState((state) => state.locale);
  const wireLocales = useMemo(
    () => ({ ...locales, locales: [...locales.locales], intl: { ...locales.intl } }),
    [locales],
  );
  const store = useEditor();
  const [host, setHost] = useState<CanvasHost | null>(null);
  const [breakpoint, setBreakpoint] = useState(config.breakpoints[0]?.id ?? 'desktop');
  const [publishOpen, setPublishOpen] = useState(false);
  const [pageOptionsOpen, setPageOptionsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('content');
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('blocks');
  const [removal, setRemoval] = useState<RemoveRequest | null>(null);
  const [searchFocus, setSearchFocus] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelsRef = useRef<ShellPanels | undefined>(undefined);
  const [diagnostics, setDiagnostics] = useState<
    NonNullable<Parameters<typeof IssuesPanel>[0]['canvasDiagnostics']>
  >([]);
  const area = useRef<HTMLDivElement>(null);
  const engine = useDragEngine();
  const forward = useForwardedKeys();
  const data = useDataContext(adapter, documentRef);
  const preview = usePreview({ adapter, docRef: documentRef });
  const toast = useToast();
  const notifyLocked = useStructureLockedNotice();
  const previewError = preview.error;
  const [title, setTitle] = useState(ready.loaded.title);
  const canRename = adapter.rename !== undefined;
  const changeTitle = useCallback(
    async (next: string) => {
      try {
        const saved = await adapter.rename?.(documentRef, next);
        if (saved !== undefined) setTitle(saved.title);
      } catch (error) {
        toast.show({ id: 'rename', variant: 'error', message: t('toolbar.title.renameFailed') });
        throw error;
      }
    },
    [adapter, documentRef, toast, t],
  );
  useEffect(() => {
    if (previewError === '') toast.dismiss('preview');
    else toast.show({ id: 'preview', variant: 'error', message: previewError });
  }, [previewError, toast]);
  const publicUrl = useMemo(() => publicAddress(adapter, documentRef), [adapter, documentRef]);
  const issueItems = useIssues(diagnostics);
  const checked = useEditorState((state) => state.validation !== undefined);
  // The store only schedules the checks after a change, so a freshly opened page would stay
  // "unchecked" (an empty drawer and a green status bar) until something ran them by hand.
  useEffect(() => {
    if (!checked) store.validateNow();
  }, [checked, store]);
  const issueCounts = checked ? countIssues(issueItems) : undefined;

  // Below the overlay breakpoint the inspector is a sheet: a block the author picks on the canvas
  // opens it. Only a pick on the canvas does (the focus sits in its frame then); a selection that
  // came from a panel, a shortcut or a command leaves the sheets as they are.
  const selectedIds = useEditorState((state) => state.selectedIds);
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const panels = panelsRef.current;
    if (panels === undefined || !panels.narrow || panels.open.right) return;
    const frame = area.current?.querySelector('iframe');
    if (frame !== null && frame !== undefined && document.activeElement === frame)
      panels.toggle('right');
  }, [selectedIds]);

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
    return host.state.subscribe((state) => {
      setDiagnostics(state.diagnostics as never);
    });
  }, [host]);

  const changeBreakpoint = useCallback(
    (id: string) => {
      setBreakpoint(id);
      host?.setBreakpoint(id);
    },
    [host],
  );

  // Removing: a node without blocks inside goes at once, with an Undo toast; one with blocks asks first.
  const removeNow = (request: RemoveRequest) => {
    const { doc } = store.getState();
    const [first] = request.ids;
    const node = first === undefined ? undefined : doc.nodes[first];
    const base = node?.name ?? componentMeta(manifest, node?.type ?? '')?.label ?? node?.type ?? '';
    const name = request.ids.length > 1 ? `${base} +${request.ids.length - 1}` : base;
    const result = store.dispatch({ type: 'node.remove', payload: { ids: [...request.ids] } });
    if (!result.ok) {
      toast.show({ id: 'remove.undo', variant: 'error', message: result.error.message });
      return;
    }
    const version = store.getState().docVersion;
    toast.show({
      id: 'remove.undo',
      variant: 'success',
      message:
        request.ids.length > 1
          ? plural('toast.deletedCount', request.ids.length)
          : interpolate(t('toast.deleted'), { name }),
      action: {
        label: t('toast.undo'),
        onSelect: () => {
          // Never undo a later, unrelated edit from an old notification.
          if (store.getState().docVersion === version) store.undo();
          toast.dismiss('remove.undo');
        },
      },
    });
  };
  const requestRemoveRef = useRef((_request: RemoveRequest) => {});
  requestRemoveRef.current = (request) => {
    if (structureLockedIds(store.getState().doc, request.ids).length > 0) {
      notifyLocked(request.ids);
      return;
    }
    if (request.hasDescendants) setRemoval(request);
    else removeNow(request);
  };
  const requestRemove = useCallback(
    (request: RemoveRequest) => requestRemoveRef.current(request),
    [],
  );

  const focusSearch = () => {
    revealLeft(panelsRef.current, 'blocks');
    setPaletteMode('blocks');
    setSearchFocus((count) => count + 1);
  };
  // Once the Blocks tab is mounted and the panel is open, put the caret in the search field.
  useEffect(() => {
    if (searchFocus === 0) return;
    searchRef.current?.focus();
    searchRef.current?.select();
  }, [searchFocus]);

  bridge.current.setDevice = (key) => {
    const target = config.breakpoints[Number(key) - 1];
    if (target !== undefined) changeBreakpoint(target.id);
  };
  bridge.current.togglePanels = () => {
    const panels = panelsRef.current;
    if (panels === undefined) return;
    if (panels.narrow) {
      // Below the overlay breakpoint the panels are overlays: close the open one, else open the left.
      panels.toggle(panels.open.right ? 'right' : 'left');
      return;
    }
    const anyOpen = panels.collapsed?.left !== true || panels.collapsed?.right !== true;
    if (anyOpen) panels.collapseAll?.();
    else panels.expandAll?.();
  };
  bridge.current.focusBlockSearch = focusSearch;
  bridge.current.onRemove = requestRemove;

  return (
    <>
      <EditorLayout
        toolbar={
          <Toolbar
            title={title}
            onTitleChange={canRename ? changeTitle : undefined}
            slug={ready.loaded.slug}
            status={ready.loaded.status}
            breakpoints={config.breakpoints}
            breakpoint={breakpoint}
            onBreakpointChange={changeBreakpoint}
            cmsUrl={adapter.cmsUrl?.(documentRef)}
            historyUrl={props.historyUrl ?? optionalUrl(adapter, 'historyUrl', documentRef)}
            helpUrl={optionalUrl(adapter, 'helpUrl', documentRef)}
            onPreview={preview.preview}
            onPublish={() => setPublishOpen(true)}
            canPublish={ready.canPublish}
            onLocaleChange={(next) => host?.setLocale(next)}
            sample={{
              adapter,
              docRef: documentRef,
              onChange: (contextRef) =>
                host?.setContextRef(contextRef ?? ready.loaded.contextRef ?? null),
            }}
            pageOptionsOpen={pageOptionsOpen}
            onPageOptionsOpenChange={setPageOptionsOpen}
          />
        }
        left={
          <LeftColumn
            mode={paletteMode}
            onModeChange={setPaletteMode}
            searchRef={searchRef}
            onRemoveRequest={requestRemove}
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
              contextRef={ready.loaded.contextRef ?? null}
              onHost={setHost}
              emptyPage={{
                onAddBlock: focusSearch,
                onPickPattern: () => {
                  revealLeft(panelsRef.current, 'blocks');
                  setPaletteMode('patterns');
                },
              }}
              callbacks={{
                onLocked: notifyLocked,
                onAction: (event) => {
                  const { id, action } = event;
                  const { doc } = store.getState();
                  const index = createIndex(doc);
                  const parentId = index.parentOf[id];
                  if (action === 'selectParent') {
                    if (parentId && parentId !== doc.root) store.select(parentId);
                    else store.clearSelection();
                  } else if (action === 'remove')
                    requestRemove({ ids: [id], hasDescendants: hasDescendants(doc, [id]) });
                  else if (action === 'duplicate')
                    store.dispatch({ type: 'node.duplicate', payload: { ids: [id] } });
                  else if (action === 'align')
                    store.dispatch({
                      type: 'node.setStyle',
                      payload: {
                        id,
                        layer: {},
                        group: 'typography',
                        property: 'textAlign',
                        value: event.value,
                      },
                    });
                  else if (action === 'more') {
                    const rect = area.current?.querySelector('iframe')?.getBoundingClientRect();
                    const frame = area.current?.querySelector('iframe');
                    const scale = rect && frame?.offsetWidth ? rect.width / frame.offsetWidth : 1;
                    setCanvasMenu({
                      id,
                      x: (rect?.left ?? 0) + (event.point?.x ?? 0) * scale,
                      y: (rect?.top ?? 0) + (event.point?.y ?? 0) * scale,
                    });
                  } else {
                    const slot = index.slotOf[id];
                    const position = index.indexOf[id];
                    if (!parentId || !slot || position === undefined) return;
                    const target = position + (action === 'moveUp' ? -1 : 1);
                    const siblings = doc.nodes[parentId]?.slots?.[slot] ?? [];
                    if (target >= 0 && target < siblings.length)
                      store.dispatch({
                        type: 'node.move',
                        payload: {
                          ids: [id],
                          parentId,
                          slot,
                          index: action === 'moveUp' ? target : target + 1,
                        },
                      });
                  }
                },
                onInsert: ({ target }) => {
                  const children =
                    store.getState().doc.nodes[target.parentId]?.slots?.[target.slot] ?? [];
                  const previous = children[target.index - 1];
                  store.select(previous ?? target.parentId);
                  // After the selection: a selection change ends the previous target.
                  view.setInsertionTarget(target);
                  focusSearch();
                },
                onKeyDown: (event) => {
                  forward({ key: event.key, mods: event.mods });
                },
                onDropTarget: (event) =>
                  engine.receiveTarget(event.target as never, event.reason as never),
              }}
            />
          </div>
        }
        right={
          <InspectorDataProvider schema={data.schema} context={data.context}>
            <StyleSectionsProvider>
              <Inspector
                locale={locale}
                defaultLocale={locales.default}
                tab={inspectorTab}
                onTabChange={setInspectorTab}
                headerActions={<SectionsToggle />}
                onPageSettings={() => setPageOptionsOpen(true)}
                onRemoveRequest={requestRemove}
                renderStyle={(node, query) => (
                  <StyleInspector
                    node={node}
                    query={query}
                    {...(breakpoint === config.breakpoints[0]?.id ? {} : { breakpoint })}
                  />
                )}
              />
            </StyleSectionsProvider>
          </InspectorDataProvider>
        }
        rightRail={<RightRail tab={inspectorTab} onTabChange={setInspectorTab} />}
        breadcrumbs={<Breadcrumbs />}
        issues={<IssuesPanel canvasDiagnostics={diagnostics} />}
        issueCounts={issueCounts}
        status={
          <>
            <PanelsTap into={panelsRef} />
            <button
              type="button"
              className="bd-status-btn"
              aria-pressed={view.outlines}
              aria-label={t('statusBar.guides')}
              title={t('statusBar.guides')}
              onClick={view.toggleOutlines}
            >
              <Icon name="square-dashed" />
            </button>
            <StatusInfo host={host} breakpoints={config.breakpoints} breakpoint={breakpoint} />
          </>
        }
      />
      {canvasMenu ? (
        <div
          role="menu"
          className="bd-menu bd-menu-in"
          ref={canvasMenuRef}
          data-state="open"
          aria-label={t('layers.menu')}
          style={{ position: 'fixed', left: canvasMenu.x, top: canvasMenu.y, zIndex: 1000 }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setCanvasMenu(null);
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="bd-menu-item"
            onClick={() => {
              setRenameId(canvasMenu.id);
              setCanvasMenu(null);
            }}
          >
            {t('layers.menu.rename')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="bd-menu-item"
            onClick={() => {
              if (isNodeStructureLocked(store.getState().doc, canvasMenu.id))
                notifyLocked([canvasMenu.id]);
              else store.dispatch({ type: 'node.duplicate', payload: { ids: [canvasMenu.id] } });
              setCanvasMenu(null);
            }}
          >
            {t('layers.menu.duplicate')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="bd-menu-item"
            onClick={() => {
              requestRemove({
                ids: [canvasMenu.id],
                hasDescendants: hasDescendants(store.getState().doc, [canvasMenu.id]),
              });
              setCanvasMenu(null);
            }}
          >
            {t('layers.menu.delete')}
          </button>
        </div>
      ) : null}
      {renameId ? (
        <input
          aria-label={t('layers.rename')}
          defaultValue={store.getState().doc.nodes[renameId]?.name ?? ''}
          ref={(input) => input?.focus()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setRenameId(null);
            if (event.key === 'Enter') {
              store.dispatch({
                type: 'node.setAttr',
                payload: { id: renameId, key: 'name', value: event.currentTarget.value || null },
              });
              setRenameId(null);
            }
          }}
        />
      ) : null}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        canvasDiagnostics={diagnostics}
        pageName={title}
        address={publicUrl}
      />
      <RemoveConfirm
        request={removal}
        onCancel={() => setRemoval(null)}
        onConfirm={(request) => {
          setRemoval(null);
          removeNow(request);
        }}
      />
      {preview.overlay}
    </>
  );
}
