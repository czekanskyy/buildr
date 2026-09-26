import {
  type DataSource,
  type FilterNode,
  type JsonValue,
  type MediaAsset,
  queryResultSchema,
  type ResolvedQuerySpec,
} from '@next-buildr/core';
import { describe, expect, it } from 'vitest';

/** The data a `DataSource` under test must be seeded with (`collections` by alias, `media` by id). */
export interface DataSourceFixture {
  readonly collections: Readonly<Record<string, readonly JsonValue[]>>;
  readonly media: Readonly<Record<string, MediaAsset>>;
}

export const DATA_SOURCE_FIXTURE: DataSourceFixture = {
  collections: {
    posts: [
      { id: '1', title: 'Alpha', views: 10, tags: ['a', 'b'], author: { name: 'Ann' }, live: true },
      { id: '2', title: 'Beta', views: 20, tags: ['b'], author: { name: 'Bob' }, live: true },
      { id: '3', title: 'Gamma', views: 30, tags: [], author: { name: 'Ann' }, live: false },
      { id: '4', title: 'Delta', views: 20, tags: ['c'], author: { name: 'Cy' }, live: true },
      { id: '5', title: 'Epsilon', views: 5, live: true },
    ],
  },
  media: {
    m1: { id: 'm1', url: 'https://cdn.test/m1.jpg', alt: 'One', mimeType: 'image/jpeg' },
    m2: { id: 'm2', url: 'https://cdn.test/m2.png', width: 10, height: 20, mimeType: 'image/png' },
  },
};

type Query = Partial<Omit<ResolvedQuerySpec, 'where'>> & { where?: FilterNode<JsonValue> };

const CTX = { locale: 'en', mode: 'production' } as const;

function spec(query: Query = {}): ResolvedQuerySpec {
  return { source: 'posts', limit: 50, page: 1, ...query };
}

const eq = (field: string, value: JsonValue): FilterNode<JsonValue> => ({ field, op: 'eq', value });

/**
 * The behaviour every `DataSource` must share (ADR-018), reused by the in-memory source now and by
 * the Payload and HTTP sources later. `create` builds a source seeded with
 * `DATA_SOURCE_FIXTURE`. Semantics under test: comparisons are strict and typed; a missing field
 * never satisfies `eq`/`in`/`gt..lte`/`contains` but does satisfy `neq`/`nin`; missing values sort
 * last in both directions; ties keep collection order; text is ordered by code unit (the fixture
 * only uses ASCII, so collation differences do not matter).
 */
export function runDataSourceContract(
  label: string,
  create: (fixture: DataSourceFixture) => DataSource | Promise<DataSource>,
): void {
  describe(`DataSource contract: ${label}`, () => {
    async function titles(query: Query): Promise<string[]> {
      const source = await create(DATA_SOURCE_FIXTURE);
      const result = await source.query(spec(query), CTX);
      return result.items.map((item) => (item as { title: string }).title);
    }

    describe('getMedia', () => {
      it('returns every requested asset in one call', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        const found = await source.getMedia(['m1', 'm2'], CTX);
        expect(Object.keys(found).sort()).toEqual(['m1', 'm2']);
        expect(found['m1']).toMatchObject({ id: 'm1', url: 'https://cdn.test/m1.jpg' });
      });

      it('omits ids that do not exist and returns nothing for no ids', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        expect(Object.keys(await source.getMedia(['m1', 'nope'], CTX))).toEqual(['m1']);
        expect(await source.getMedia([], CTX)).toEqual({});
        expect(await source.getMedia(['__proto__', 'constructor'], CTX)).toEqual({});
      });
    });

    describe('query: filters', () => {
      it.each<[string, FilterNode<JsonValue>, string[]]>([
        ['eq string', eq('title', 'Beta'), ['Beta']],
        ['eq is typed', eq('views', '20'), []],
        ['eq number', eq('views', 20), ['Beta', 'Delta']],
        ['eq boolean', eq('live', false), ['Gamma']],
        ['eq nested field', eq('author.name', 'Ann'), ['Alpha', 'Gamma']],
        ['eq never matches a missing field', eq('author.name', null), []],
        [
          'neq matches missing fields',
          { field: 'author.name', op: 'neq', value: 'Ann' },
          ['Beta', 'Delta', 'Epsilon'],
        ],
        ['in', { field: 'title', op: 'in', value: ['Alpha', 'Delta', 'Zeta'] }, ['Alpha', 'Delta']],
        ['in with a non-list matches nothing', { field: 'title', op: 'in', value: 'Alpha' }, []],
        [
          'nin',
          { field: 'title', op: 'nin', value: ['Alpha', 'Beta', 'Gamma'] },
          ['Delta', 'Epsilon'],
        ],
        ['contains text', { field: 'title', op: 'contains', value: 'ta' }, ['Beta', 'Delta']],
        ['contains is case-sensitive', { field: 'title', op: 'contains', value: 'ALPHA' }, []],
        ['contains list element', { field: 'tags', op: 'contains', value: 'b' }, ['Alpha', 'Beta']],
        ['gt', { field: 'views', op: 'gt', value: 20 }, ['Gamma']],
        ['gte', { field: 'views', op: 'gte', value: 20 }, ['Beta', 'Gamma', 'Delta']],
        ['lt', { field: 'views', op: 'lt', value: 10 }, ['Epsilon']],
        ['lte', { field: 'views', op: 'lte', value: 10 }, ['Alpha', 'Epsilon']],
        ['gt on text', { field: 'title', op: 'gt', value: 'Delta' }, ['Epsilon', 'Gamma']],
        ['gt across types matches nothing', { field: 'views', op: 'gt', value: 'a' }, []],
        [
          'exists true',
          { field: 'author.name', op: 'exists', value: true },
          ['Alpha', 'Beta', 'Gamma', 'Delta'],
        ],
        ['exists false', { field: 'author.name', op: 'exists', value: false }, ['Epsilon']],
        [
          'and',
          { and: [eq('live', true), { field: 'views', op: 'gte', value: 20 }] },
          ['Beta', 'Delta'],
        ],
        ['or', { or: [eq('title', 'Alpha'), eq('title', 'Gamma')] }, ['Alpha', 'Gamma']],
        [
          'nested groups',
          { and: [eq('live', true), { or: [eq('views', 5), eq('author.name', 'Cy')] }] },
          ['Delta', 'Epsilon'],
        ],
      ])('%s', async (_name, where, expected) => {
        const found = await titles({ where, sort: [{ field: 'title', dir: 'asc' }] });
        expect(found).toEqual([...expected].sort());
      });
    });

    describe('query: sorting and paging', () => {
      it('sorts ascending and descending', async () => {
        expect(
          await titles({
            sort: [
              { field: 'views', dir: 'asc' },
              { field: 'title', dir: 'asc' },
            ],
          }),
        ).toEqual(['Epsilon', 'Alpha', 'Beta', 'Delta', 'Gamma']);
        expect(await titles({ sort: [{ field: 'title', dir: 'desc' }] })).toEqual([
          'Gamma',
          'Epsilon',
          'Delta',
          'Beta',
          'Alpha',
        ]);
      });

      it('breaks ties with the next key and then keeps collection order', async () => {
        expect(
          await titles({
            sort: [
              { field: 'views', dir: 'desc' },
              { field: 'title', dir: 'desc' },
            ],
          }),
        ).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha', 'Epsilon']);
        expect(await titles({ sort: [{ field: 'views', dir: 'asc' }] })).toEqual([
          'Epsilon',
          'Alpha',
          'Beta',
          'Delta',
          'Gamma',
        ]);
      });

      it('sorts missing values last in both directions', async () => {
        expect((await titles({ sort: [{ field: 'author.name', dir: 'asc' }] })).at(-1)).toBe(
          'Epsilon',
        );
        expect((await titles({ sort: [{ field: 'author.name', dir: 'desc' }] })).at(-1)).toBe(
          'Epsilon',
        );
      });

      it('pages results and reports totals', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        const sort = [{ field: 'title', dir: 'asc' }] as const;
        const first = await source.query(spec({ sort, limit: 2, page: 1 }), CTX);
        const second = await source.query(spec({ sort, limit: 2, page: 2 }), CTX);
        const last = await source.query(spec({ sort, limit: 2, page: 3 }), CTX);
        const beyond = await source.query(spec({ sort, limit: 2, page: 4 }), CTX);
        const name = (r: typeof first) => r.items.map((i) => (i as { title: string }).title);
        expect(name(first)).toEqual(['Alpha', 'Beta']);
        expect(name(second)).toEqual(['Delta', 'Epsilon']);
        expect(name(last)).toEqual(['Gamma']);
        expect(beyond.items).toEqual([]);
        for (const r of [first, second, last, beyond]) {
          expect(r).toMatchObject({ total: 5, totalPages: 3 });
        }
        expect([first.page, second.page, last.page, beyond.page]).toEqual([1, 2, 3, 4]);
      });

      it('counts the total after filtering', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        const result = await source.query(spec({ where: eq('live', true), limit: 1 }), CTX);
        expect(result).toMatchObject({ total: 4, totalPages: 4 });
        expect(result.items).toHaveLength(1);
        const empty = await source.query(spec({ where: eq('live', 'maybe') }), CTX);
        expect(empty).toMatchObject({ items: [], total: 0, totalPages: 0 });
      });

      it('leaves out the excluded id', async () => {
        expect(await titles({ excludeId: '2', sort: [{ field: 'title', dir: 'asc' }] })).toEqual([
          'Alpha',
          'Delta',
          'Epsilon',
          'Gamma',
        ]);
        expect((await titles({ excludeId: 2 })).length).toBe(4);
      });
    });

    describe('query: contract', () => {
      it('returns a result that matches the result schema and is plain JSON', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        const result = await source.query(spec({ limit: 2 }), CTX);
        expect(queryResultSchema.safeParse(result).success).toBe(true);
        expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      });

      it('rejects a collection that is not allowed, including prototype names', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        for (const name of ['secrets', '__proto__', 'constructor', 'toString']) {
          await expect(source.query(spec({ source: name }), CTX)).rejects.toThrow();
        }
      });

      it('never matches through a prototype field', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        for (const field of ['__proto__', 'constructor.name', 'toString']) {
          const outcome = await source
            .query(spec({ where: { field, op: 'exists', value: true } }), CTX)
            .then((r) => r.items.length)
            .catch(() => 0);
          expect(outcome).toBe(0);
        }
      });

      it('does not mutate what it returns into the store', async () => {
        const source = await create(DATA_SOURCE_FIXTURE);
        const first = await source.query(spec({ limit: 1 }), CTX);
        (first.items[0] as { title: string }).title = 'Changed';
        const again = await source.query(spec({ limit: 1 }), CTX);
        expect((again.items[0] as { title: string }).title).toBe('Alpha');
      });
    });
  });
}
