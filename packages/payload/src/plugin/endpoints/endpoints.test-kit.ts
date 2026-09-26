import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  p,
  s,
} from '@next-buildr/core';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import {
  buildConfig,
  type CollectionConfig,
  type Config,
  type EmailAdapter,
  type Field,
  type GlobalConfig,
  getPayload,
  handleEndpoints,
  type Payload,
} from 'payload';
import { buildrPlugin } from '../index.ts';
import type { BuildrPluginOptions } from '../options.ts';

const base: ComponentMeta = {
  type: 'buildr/widget',
  version: 2,
  label: 'Widget',
  category: 'content',
  props: { title: p.text({ label: 'Title', default: 'Hello' }) },
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  slots: {},
};
const page: ComponentMeta = {
  ...base,
  type: 'buildr/page',
  version: 1,
  label: 'Page',
  props: {},
  capabilities: { root: true },
  slots: { default: {} },
};
const image: ComponentMeta = {
  ...base,
  type: 'buildr/image',
  version: 1,
  label: 'Image',
  props: { alt: p.text({ label: 'Alt', default: '' }) },
};

export const meta = createRegistryMeta({ components: [page, base, image] });
/** The widget renamed `label` to `title` in version 2. */
export const migrations = {
  'buildr/page': { currentVersion: 1, steps: [] },
  'buildr/image': { currentVersion: 1, steps: [] },
  'buildr/widget': {
    currentVersion: 2,
    steps: [
      {
        from: 1,
        to: 2,
        migrate: (props: Record<string, unknown> | undefined) => {
          const { label, ...rest } = props ?? {};
          return { ...rest, title: label } as never;
        },
      },
    ],
  },
} as never;

/** A page with one child (a widget unless `type` says otherwise) carrying `props`. */
export const withChild = (
  props: Record<string, unknown>,
  options: { version?: number; type?: string } = {},
): BuilderDocument => {
  const type = options.type ?? 'buildr/widget';
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: ['child00001'] } },
      child00001: { id: 'child00001', type, props },
    },
    components: { 'buildr/page': 1, [type]: options.version ?? (type === 'buildr/widget' ? 2 : 1) },
  } as never;
};
export const title = (text: string) => ({ title: s(text) });

export interface Harness {
  readonly payload: Payload;
  readonly token: string;
  /** A request to `/api{path}` as the logged-in user (or, with `token: null`, anonymously). */
  readonly call: (
    method: string,
    path: string,
    options?: { body?: unknown; token?: string | null; headers?: Record<string, string> },
  ) => Promise<{ status: number; body: any }>;
  /** Creates a user and returns their token. */
  readonly login: (email: string, role?: string) => Promise<string>;
  readonly close: () => void;
}

/** One live Payload per test file: its schema push shares process-wide state. */
export async function boot(
  key: string,
  options: Partial<BuildrPluginOptions> = {},
  extra: {
    readonly pageFields?: Field[];
    /** Access control of the pages collection (default: Payload default, authenticated only). */
    readonly pageAccess?: CollectionConfig['access'];
    readonly collections?: CollectionConfig[];
    readonly globals?: GlobalConfig[];
    readonly email?: EmailAdapter;
    /** Payload localization; the `title` of the pages is then localized. */
    readonly localization?: Config['localization'];
  } = {},
): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), `buildr-payload-${key}-`));
  const config = buildConfig({
    secret: 'test-secret',
    collections: [
      {
        slug: 'pages',
        admin: { useAsTitle: 'title' },
        fields: [
          { name: 'title', type: 'text', localized: extra.localization !== undefined },
          { name: 'slug', type: 'text' },
          ...(extra.pageFields ?? []),
        ],
        ...(extra.pageAccess === undefined ? {} : { access: extra.pageAccess }),
        versions: { drafts: { autosave: true }, maxPerDoc: 50 },
      },
      ...(extra.collections ?? []),
    ],
    ...(extra.globals === undefined ? {} : { globals: extra.globals }),
    ...(extra.email === undefined ? {} : { email: extra.email }),
    ...(extra.localization === undefined ? {} : { localization: extra.localization }),
    db: sqliteAdapter({ client: { url: `file:${join(dir, 'db.sqlite')}` } }),
    plugins: [
      buildrPlugin({
        collections: { pages: { context: 'page', path: (doc) => `/${String(doc['slug'])}` } },
        registry: { meta, migrations },
        ...options,
      }),
    ],
    typescript: { autoGenerate: false },
  });
  const payload = await getPayload({ config, key });
  const login = async (email: string) => {
    await payload.create({ collection: 'users', data: { email, password: 'secret-password' } });
    const result = await payload.login({
      collection: 'users',
      data: { email, password: 'secret-password' },
    });
    return result.token as string;
  };
  const token = await login('editor@example.com');
  const call: Harness['call'] = async (method, path, init = {}) => {
    const authToken = init.token === undefined ? token : init.token;
    const response = await handleEndpoints({
      config: payload.config,
      request: new Request(`http://localhost/api${path}`, {
        method,
        headers: {
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(authToken === null ? {} : { authorization: `JWT ${authToken}` }),
          ...init.headers,
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
    });
    const text = await response.text();
    return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
  };
  return {
    payload,
    token,
    call,
    login,
    close: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows keeps the database file open a moment longer.
      }
    },
  };
}
