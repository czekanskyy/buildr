import { describe, expect, it } from 'vitest';
import type { DataField } from '../schema/data-type.ts';
import type { DataSchema } from './schema.ts';
import { dataSchemaSchema, listPaths, schemaAtPath } from './schema.ts';

const authorEntity: DataField = {
  type: {
    t: 'object',
    fields: {
      name: { type: { t: 'string' } },
      bio: { type: { t: 'richText' }, nullable: true },
    },
  },
};

const categoryEntity: DataField = {
  type: { t: 'object', fields: { label: { type: { t: 'string' } } } },
};

/** A `category` entity that refers back to itself, used only by the cycle-specific tests below. */
const cyclicCategoryEntity: DataField = {
  type: {
    t: 'object',
    fields: {
      label: { type: { t: 'string' } },
      parent: { type: { t: 'ref', entity: 'category' } },
    },
  },
};

function schema(): DataSchema {
  return {
    scopes: {
      site: { type: { t: 'object', fields: { name: { type: { t: 'string' } } } } },
      post: {
        type: {
          t: 'object',
          fields: {
            title: { type: { t: 'string' } },
            author: { type: { t: 'ref', entity: 'author' } },
            category: { type: { t: 'ref', entity: 'category' } },
            price: { type: { t: 'number' } },
            images: { type: { t: 'list', of: { t: 'media' } } },
          },
        },
      },
    },
    entities: { author: authorEntity, category: categoryEntity },
  };
}

describe('schemaAtPath', () => {
  it('finds a top-level scope field', () => {
    expect(schemaAtPath(schema(), 'post.title')).toEqual({ type: { t: 'string' } });
  });

  it('follows a ref field into an entity', () => {
    expect(schemaAtPath(schema(), 'post.author.name')).toEqual({ type: { t: 'string' } });
  });

  it('returns the list field itself for a plain path (no descent without an index)', () => {
    expect(schemaAtPath(schema(), 'post.images')).toEqual({
      type: { t: 'list', of: { t: 'media' } },
    });
  });

  it('resolves any numeric index against a list to its element type', () => {
    expect(schemaAtPath(schema(), 'post.images[0]')).toEqual({ type: { t: 'media' } });
    expect(schemaAtPath(schema(), 'post.images[41]')).toEqual({ type: { t: 'media' } });
  });

  it('returns undefined for an index against a non-list field', () => {
    expect(schemaAtPath(schema(), 'post.title[0]')).toBeUndefined();
  });

  it('returns undefined for a key against a non-object field', () => {
    expect(schemaAtPath(schema(), 'post.price.foo')).toBeUndefined();
  });

  it('returns undefined for an unknown scope', () => {
    expect(schemaAtPath(schema(), 'route.path')).toBeUndefined();
  });

  it('returns undefined for an unknown nested field', () => {
    expect(schemaAtPath(schema(), 'post.subtitle')).toBeUndefined();
    expect(schemaAtPath(schema(), 'post.author.email')).toBeUndefined();
  });

  it('returns undefined for a ref to an unknown entity', () => {
    const withDanglingRef: DataSchema = {
      scopes: { post: { type: { t: 'ref', entity: 'missing' } } },
      entities: {},
    };
    expect(schemaAtPath(withDanglingRef, 'post.anything')).toBeUndefined();
  });

  it('follows a self-referencing ref chain across several hops', () => {
    const withCycle: DataSchema = {
      scopes: { post: { type: { t: 'ref', entity: 'category' } } },
      entities: { category: cyclicCategoryEntity },
    };
    expect(schemaAtPath(withCycle, 'post.parent.parent.parent.label')).toEqual({
      type: { t: 'string' },
    });
  });

  it('follows a chain of refs (ref -> ref -> object) in a single hop resolution', () => {
    const chained: DataSchema = {
      scopes: { root: { type: { t: 'ref', entity: 'a' } } },
      entities: {
        a: { type: { t: 'ref', entity: 'b' } },
        b: { type: { t: 'ref', entity: 'c' } },
        c: { type: { t: 'object', fields: { x: { type: { t: 'string' } } } } },
      },
    };
    expect(schemaAtPath(chained, 'root.x')).toEqual({ type: { t: 'string' } });
  });

  it('returns undefined for a directly self-referencing ref instead of looping forever', () => {
    const selfRef: DataSchema = {
      scopes: { a: { type: { t: 'ref', entity: 'a' } } },
      entities: { a: { type: { t: 'ref', entity: 'a' } } },
    };
    expect(schemaAtPath(selfRef, 'a')).toBeUndefined();
  });

  it('returns undefined for a syntactically invalid path', () => {
    expect(schemaAtPath(schema(), 'post..title')).toBeUndefined();
    expect(schemaAtPath(schema(), '__proto__')).toBeUndefined();
  });
});

describe('listPaths', () => {
  it('lists every path reachable from the scopes, following refs', () => {
    const paths = listPaths(schema());

    expect(paths).toEqual(
      expect.arrayContaining([
        'site',
        'site.name',
        'post',
        'post.title',
        'post.author',
        'post.author.name',
        'post.author.bio',
        'post.category',
        'post.price',
        'post.images',
      ]),
    );
  });

  it('does not descend into a list element (no [n] paths)', () => {
    const paths = listPaths(schema());
    expect(paths.some((p) => p.includes('['))).toBe(false);
  });

  it('filters by resolved DataType tag', () => {
    const paths = listPaths(schema(), (type) => type.t === 'string');
    expect(paths.sort()).toEqual(
      ['post.author.name', 'post.category.label', 'post.title', 'site.name'].sort(),
    );
  });

  it('terminates on a ref cycle reachable through object fields', () => {
    const cyclic: DataSchema = {
      scopes: { post: { type: { t: 'ref', entity: 'category' } } },
      entities: { category: cyclicCategoryEntity },
    };
    expect(() => listPaths(cyclic)).not.toThrow();
    expect(listPaths(cyclic)).toEqual(expect.arrayContaining(['post', 'post.label']));
  });
});

describe('dataSchemaSchema', () => {
  it('accepts a well-formed DataSchema', () => {
    expect(dataSchemaSchema.safeParse(schema()).success).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    const result = dataSchemaSchema.safeParse({ ...schema(), extra: 1 });
    expect(result.success).toBe(false);
  });
});
