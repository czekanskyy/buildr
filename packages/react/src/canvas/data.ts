import {
  type BuilderDocument,
  type CompileCache,
  type DataContext,
  type DataSource,
  type Diagnostic,
  type NodeId,
  type PreparedData,
  prepareRender,
  type RegistryMeta,
} from '@next-buildr/core';

export const NO_DATA: PreparedData = {
  media: {},
  queries: {},
  collectionsUsed: [],
  diagnostics: [],
};

/** How long the document must stay unchanged, as far as data goes, before it is asked again. */
export const DEFAULT_DATA_DEBOUNCE_MS = 300;

/** How many results are kept, by the key of what they were fetched for. */
const CACHE_SIZE = 8;

/**
 * Everything `prepareRender` would ask a data source for, as a string: the static media refs and
 * query specs of every node (top-level props only, as `prepareRender` reads them), the aliases of
 * the Loops around them (they decide whether a query is allowed), and the context they resolve
 * against. Two documents with the same key need the same data, whatever else differs: an edit to
 * a text, a style or the order of siblings does not change it, so it never triggers a request.
 */
export function dataKey(
  doc: BuilderDocument,
  registry: Pick<RegistryMeta, 'get'>,
  context: DataContext,
): string {
  const entries: unknown[] = [context.locale, context.mode, context.scopes];
  const seen = new Set<NodeId>();
  const visit = (id: NodeId, aliases: readonly string[]): void => {
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
    if (node === undefined || seen.has(id)) return;
    seen.add(id);
    let childAliases = aliases;
    const meta = registry.get(node.type);
    if (meta !== undefined) {
      let isLoop = false;
      for (const [prop, def] of Object.entries(meta.props)) {
        if (def.kind === 'listSource') isLoop = true;
        const raw = node.props?.[prop];
        if (raw === undefined || raw.kind !== 'static') continue;
        if (def.kind === 'media' || def.kind === 'listSource') {
          entries.push([id, prop, raw.value, aliases]);
        }
      }
      if (isLoop) {
        const alias = node.props?.['as'];
        if (alias?.kind === 'static' && typeof alias.value === 'string' && alias.value !== '') {
          childAliases = [...aliases, alias.value];
        }
      }
    }
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) visit(child, childAliases);
    }
  };
  visit(doc.root, []);
  return JSON.stringify(entries);
}

export interface DataTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface DataPreparerOptions {
  readonly registry: RegistryMeta;
  /** Without one nothing is fetched: media and queries are simply absent. */
  readonly dataSource?: DataSource | undefined;
  readonly cache?: CompileCache | undefined;
  readonly debounceMs?: number;
  readonly timers?: DataTimers;
  /** Called with the data for the latest request, and with the `generation` it was requested for. */
  onData(data: PreparedData, generation: number): void;
  /** Called with whether a request is in flight. */
  onLoading(loading: boolean): void;
  /** Called with a failure of the data source that `prepareRender` itself did not report. */
  onDiagnostics(diagnostics: readonly Diagnostic[]): void;
}

export interface DataPreparer {
  /**
   * Tells it the document and context now. `generation` changes when the whole document was
   * replaced (or the context or locale changed): the data is then fetched again at once and
   * nothing cached is reused. Otherwise it is fetched only when `dataKey` changed, after
   * `debounceMs` of quiet, and a key seen before is answered from the cache.
   */
  update(doc: BuilderDocument, context: DataContext, generation: number): void;
  destroy(): void;
}

function defaultTimers(): DataTimers {
  const g = globalThis as unknown as DataTimers;
  return { setTimeout: (cb, ms) => g.setTimeout(cb, ms), clearTimeout: (h) => g.clearTimeout(h) };
}

/** Prepares the data of the canvas's document (docs/editor.md#data): what is fetched, when, and what is reused. */
export function createDataPreparer(options: DataPreparerOptions): DataPreparer {
  const timers = options.timers ?? defaultTimers();
  const debounceMs = options.debounceMs ?? DEFAULT_DATA_DEBOUNCE_MS;
  const results = new Map<string, PreparedData>();
  let timer: unknown;
  let token = 0;
  let requestedKey: string | undefined;
  let lastGeneration: number | undefined;
  let destroyed = false;

  const remember = (key: string, data: PreparedData) => {
    results.delete(key);
    results.set(key, data);
    if (results.size > CACHE_SIZE) results.delete(results.keys().next().value as string);
  };

  const run = (key: string, doc: BuilderDocument, context: DataContext, generation: number) => {
    const { dataSource } = options;
    if (dataSource === undefined) {
      options.onData(NO_DATA, generation);
      return;
    }
    const mine = ++token;
    options.onLoading(true);
    prepareRender(doc, options.registry, context, dataSource, {
      ...(options.cache !== undefined ? { cache: options.cache } : {}),
    })
      .then((data) => {
        if (destroyed || mine !== token) return;
        remember(key, data);
        options.onDiagnostics(data.diagnostics);
        options.onData(data, generation);
      })
      .catch((error: unknown) => {
        if (destroyed || mine !== token) return;
        // Not cached: the next change asks again.
        results.delete(key);
        requestedKey = undefined;
        options.onDiagnostics([
          {
            code: 'canvas.data-failed',
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
          },
        ]);
        options.onData(NO_DATA, generation);
      })
      .finally(() => {
        if (!destroyed && mine === token) options.onLoading(false);
      });
  };

  return {
    update(doc, context, generation) {
      if (destroyed) return;
      const key = dataKey(doc, options.registry, context);
      const replaced = generation !== lastGeneration;
      lastGeneration = generation;

      if (replaced) {
        timers.clearTimeout(timer);
        results.clear();
        requestedKey = key;
        run(key, doc, context, generation);
        return;
      }
      if (key === requestedKey) return;
      requestedKey = key;
      timers.clearTimeout(timer);

      const cached = results.get(key);
      if (cached !== undefined) {
        token++; // whatever is in flight is for an older document
        remember(key, cached);
        options.onLoading(false);
        options.onData(cached, generation);
        return;
      }
      timer = timers.setTimeout(() => run(key, doc, context, generation), debounceMs);
    },
    destroy() {
      destroyed = true;
      timers.clearTimeout(timer);
    },
  };
}
