import { describe, expect, it } from 'vitest';
import { type DataType, dataFieldSchema, dataTypeSchema } from './data-type.ts';

describe('dataTypeSchema', () => {
  const valid: DataType[] = [
    { t: 'string' },
    { t: 'number' },
    { t: 'boolean' },
    { t: 'date' },
    { t: 'url' },
    { t: 'richText' },
    { t: 'media' },
    { t: 'link' },
    { t: 'enum', values: ['a', 'b'] },
    { t: 'ref', entity: 'author' },
    { t: 'list', of: { t: 'string' } },
    { t: 'object', fields: { title: { type: { t: 'string' } } } },
  ];

  for (const dataType of valid) {
    it(`accepts ${JSON.stringify(dataType)}`, () => {
      expect(dataTypeSchema.safeParse(dataType).success).toBe(true);
    });
  }

  it('accepts a nested object/list combination', () => {
    const dataType: DataType = {
      t: 'object',
      fields: {
        images: { type: { t: 'list', of: { t: 'media' } }, label: 'Images' },
        author: { type: { t: 'object', fields: { name: { type: { t: 'string' } } } } },
      },
    };
    expect(dataTypeSchema.safeParse(dataType).success).toBe(true);
  });

  it('rejects an unknown t', () => {
    expect(dataTypeSchema.safeParse({ t: 'unknown' }).success).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    expect(dataTypeSchema.safeParse({ t: 'string', extra: true }).success).toBe(false);
  });

  it('rejects enum values that are not strings', () => {
    expect(dataTypeSchema.safeParse({ t: 'enum', values: [1, 2] }).success).toBe(false);
  });

  it('rejects a list with no "of"', () => {
    expect(dataTypeSchema.safeParse({ t: 'list' }).success).toBe(false);
  });
});

describe('dataFieldSchema', () => {
  it('accepts a minimal field', () => {
    expect(dataFieldSchema.safeParse({ type: { t: 'string' } }).success).toBe(true);
  });

  it('accepts label/nullable/description', () => {
    const result = dataFieldSchema.safeParse({
      type: { t: 'number' },
      label: 'Count',
      nullable: true,
      description: 'x',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing type', () => {
    expect(dataFieldSchema.safeParse({ label: 'x' }).success).toBe(false);
  });
});
