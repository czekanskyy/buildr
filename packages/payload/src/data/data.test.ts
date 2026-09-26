import { schemaAtPath } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { buildContext } from './build-context.ts';
import { normalizeDoc, normalizeMedia } from './normalize.ts';
import {
  type CollectionLike,
  type FieldLike,
  type SchemaOptions,
  type SchemaSource,
  schemaFromCollection,
} from './schema-from-fields.ts';

const text = (name: string, extra: Partial<FieldLike> = {}): FieldLike => ({
  type: 'text',
  name,
  ...extra,
});

const posts: CollectionLike = {
  slug: 'posts',
  fields: [
    text('title', { label: 'Title' }),
    { type: 'textarea', name: 'excerpt' },
    { type: 'number', name: 'readingTime' },
    { type: 'checkbox', name: 'featured' },
    { type: 'date', name: 'publishedAt' },
    { type: 'select', name: 'kind', options: ['news', { label: 'Guide', value: 'guide' }] },
    { type: 'select', name: 'flags', hasMany: true, options: ['a', 'b'] },
    { type: 'richText', name: 'content' },
    { type: 'upload', name: 'cover', relationTo: 'media' },
    { type: 'upload', name: 'gallery', relationTo: 'media', hasMany: true },
    { type: 'relationship', name: 'author', relationTo: 'authors' },
    { type: 'relationship', name: 'tags', relationTo: 'tags', hasMany: true },
    { type: 'relationship', name: 'owner', relationTo: 'users' },
    { type: 'relationship', name: 'either', relationTo: ['authors', 'tags'] },
    {
      type: 'group',
      name: 'seo',
      fields: [text('title'), text('internalNote', { hidden: true })],
    },
    { type: 'array', name: 'facts', fields: [text('label'), { type: 'number', name: 'value' }] },
    { type: 'row', fields: [text('subtitle')] },
    { type: 'tabs', tabs: [{ fields: [text('lead')] }, { name: 'extra', fields: [text('note')] }] },
    // Never data for a binding:
    { type: 'blocks', name: 'sections' },
    { type: 'json', name: 'layout' },
    { type: 'json', name: 'raw' },
    { type: 'point', name: 'where' },
    text('password'),
    text('resetPasswordToken'),
    text('apiKey'),
    text('secretNotes'),
    text('draftOnly', { hidden: true }),
    text('restricted', { access: { read: () => false } }),
    { type: 'number', name: 'buildrRevision' },
    { type: 'text', name: '_status' },
    { type: 'ui', name: 'preview' },
  ],
};
const authors: CollectionLike = {
  slug: 'authors',
  fields: [
    text('name'),
    { type: 'upload', name: 'avatar', relationTo: 'media' },
    { type: 'relationship', name: 'user', relationTo: 'users' },
    { type: 'relationship', name: 'posts', relationTo: 'posts', hasMany: true },
    text('salt'),
  ],
};
const users: CollectionLike = {
  slug: 'users',
  auth: true,
  fields: [text('email'), text('name'), text('role'), text('password')],
};
const tags: CollectionLike = { slug: 'tags', fields: [text('title')] };
const media: CollectionLike = { slug: 'media', fields: [text('alt')] };
const internal: CollectionLike = { slug: 'payload-preferences', fields: [text('key')] };
const settings = {
  slug: 'site-settings',
  fields: [text('siteName'), { type: 'upload', name: 'logo', relationTo: 'media' }, text('token')],
} satisfies { slug: string; fields: FieldLike[] };

const source: SchemaSource = {
  collections: [posts, authors, users, tags, media, internal],
  globals: [settings],
};
const options: SchemaOptions = { contextNames: { posts: 'post' }, siteGlobal: 'site-settings' };

const schema = () => {
  const built = schemaFromCollection(source, 'posts', options);
  if (built === undefined) throw new Error('expected a schema');
  return built;
};

describe('schemaFromCollection', () => {
  it('maps the field types of a post', () => {
    expect(schema()).toMatchSnapshot();
  });

  it('resolves paths through relations with the core schema helpers', () => {
    const built = schema();
    expect(schemaAtPath(built, 'post.title')?.type).toEqual({ t: 'string' });
    expect(schemaAtPath(built, 'post.author.name')?.type).toEqual({ t: 'string' });
    expect(schemaAtPath(built, 'post.author.avatar')?.type).toEqual({ t: 'media' });
    expect(schemaAtPath(built, 'post.seo.title')?.type).toEqual({ t: 'string' });
    expect(schemaAtPath(built, 'post.extra.note')?.type).toEqual({ t: 'string' });
    expect(schemaAtPath(built, 'site.logo')?.type).toEqual({ t: 'media' });
    expect(schemaAtPath(built, 'route.path')?.type).toEqual({ t: 'string' });
  });

  it('never exposes users, credentials, hidden or builder-owned fields', () => {
    const built = schema();
    const json = JSON.stringify(built);
    for (const forbidden of [
      'users',
      'email',
      'role',
      'password',
      'resetPasswordToken',
      'apiKey',
      'secretNotes',
      'salt',
      'token',
      'internalNote',
      'draftOnly',
      'restricted',
      'buildrRevision',
      '_status',
      'layout',
      'sections',
      'raw',
      'where',
      'either',
      'owner',
      'payload-preferences',
    ]) {
      expect(json, forbidden).not.toContain(`"${forbidden}"`);
    }
    expect(built.entities['users']).toBeUndefined();
    expect(Object.keys(built.entities).sort()).toEqual(['authors', 'post', 'tags']);
  });

  it('refuses a collection that is an auth collection or internal', () => {
    expect(schemaFromCollection(source, 'users', options)).toBeUndefined();
    expect(schemaFromCollection(source, 'payload-preferences', options)).toBeUndefined();
    expect(schemaFromCollection(source, 'nope', options)).toBeUndefined();
  });

  it('survives relations that point back (authors <-> posts)', () => {
    const built = schema();
    expect(schemaAtPath(built, 'post.author.posts')?.type.t).toBe('list');
  });
});

const doc = {
  id: 7,
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: new Date('2026-02-03T00:00:00Z'),
  title: 'Hello',
  publishedAt: '2026-03-04T05:06:07Z',
  kind: 'news',
  flags: ['a'],
  cover: {
    id: 3,
    url: '/media/cover.jpg',
    alt: 'A cover',
    width: 800,
    height: 600,
    mimeType: 'image/jpeg',
    focalX: 40,
    focalY: 60,
    filename: 'cover.jpg',
    sizes: {
      card: { url: '/media/cover-800.jpg', width: 800, height: 500 },
      og: { url: null, width: null, height: null },
    },
  },
  gallery: [5, { id: 6, url: '/media/g.jpg', mimeType: 'image/png' }],
  author: {
    id: 2,
    name: 'Ada',
    salt: 'NaCl',
    user: { id: 1, email: 'ada@example.com', password: 'hash' },
    posts: [{ id: 7, title: 'cycle' }],
  },
  tags: [{ id: 1, title: 'one' }, 9],
  owner: { id: 1, email: 'ada@example.com', hash: 'x' },
  seo: { title: 'SEO', internalNote: 'private' },
  facts: [{ label: 'a', value: 1, id: 'row1' }],
  lead: 'Lead',
  extra: { note: 'Note', secret: 'no' },
  sections: [{ blockType: 'x' }],
  password: 'p',
  resetPasswordToken: 't',
  apiKey: 'k',
  layout: { root: 'r' },
  buildrRevision: 4,
  _status: 'draft',
  unknown: 'field',
};

describe('normalizeDoc', () => {
  it('turns a populated document into plain, allow-listed data', () => {
    expect(normalizeDoc(source, posts.fields, doc, options.contextNames)).toMatchSnapshot();
  });

  it('never lets a credential or an unlisted field through, at any depth', () => {
    const json = JSON.stringify(normalizeDoc(source, posts.fields, doc, options.contextNames));
    for (const leaked of [
      'ada@example.com',
      'NaCl',
      'hash',
      'private',
      '"k"',
      'blockType',
      'root',
      'field',
      'no',
    ]) {
      expect(json).not.toContain(`"${leaked}"`);
    }
    expect(json).not.toContain('ada@example.com');
    expect(json).not.toContain('resetPasswordToken');
  });

  it('keeps an unpopulated relation as { id } and an unpopulated upload as null', () => {
    const value = normalizeDoc(
      source,
      posts.fields,
      { id: 1, author: 4, cover: 3, gallery: [1, 2] },
      options.contextNames,
    );
    expect(value['author']).toEqual({ id: '4' });
    expect(value['cover']).toBeNull();
    expect(value['gallery']).toEqual([null, null]);
  });
});

describe('normalizeMedia', () => {
  it('drops sizes without a URL and fills what Payload stores', () => {
    expect(normalizeMedia(doc.cover)).toEqual({
      id: '3',
      url: '/media/cover.jpg',
      alt: 'A cover',
      width: 800,
      height: 600,
      mimeType: 'image/jpeg',
      focalPoint: { x: 40, y: 60 },
      sizes: { card: { url: '/media/cover-800.jpg', width: 800, height: 500 } },
    });
    expect(normalizeMedia(5)).toBeNull();
    expect(normalizeMedia({ id: 1 })).toBeNull();
  });
});

describe('buildContext', () => {
  it('builds site, the document under its context name, and route', () => {
    const scopes = buildContext({
      source,
      options,
      collection: 'posts',
      doc,
      site: { siteName: 'Buildr', token: 'x', logo: doc.cover },
      route: { path: '/posts/hello', locale: 'pl' },
    });
    expect(Object.keys(scopes).sort()).toEqual(['post', 'route', 'site']);
    expect(scopes['site']).toMatchObject({ siteName: 'Buildr', logo: { id: '3' } });
    expect(JSON.stringify(scopes['site'])).not.toContain('token');
    expect(scopes['route']).toEqual({ path: '/posts/hello', locale: 'pl', params: { page: null } });
    expect((scopes['post'] as { author: { name: string } }).author.name).toBe('Ada');
  });

  it('has the shape of the schema', () => {
    const scopes = buildContext({
      source,
      options,
      collection: 'posts',
      doc,
      route: { path: '/', locale: 'pl' },
    });
    const built = schema();
    const context = scopes['post'] as Record<string, unknown>;
    const declared = Object.keys(
      (built.scopes['post'] as { type: { fields: Record<string, unknown> } }).type.fields,
    );
    expect(Object.keys(context).sort()).toEqual(declared.sort());
    expect(scopes['site']).toBeNull(); // no readable site document was given
  });
});
