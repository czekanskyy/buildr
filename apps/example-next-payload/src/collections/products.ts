import type { CollectionConfig } from 'payload';
import { isSignedIn, readPublished } from '../access.ts';
import { slugField, statusDefaults } from '../fields.ts';

export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'sku', 'price', '_status'] },
  access: { read: readPublished, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  ...statusDefaults,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'sku', type: 'text', index: true },
    { name: 'price', type: 'number', required: true, min: 0 },
    { name: 'compareAtPrice', type: 'number', min: 0 },
    { name: 'currency', type: 'select', options: ['PLN', 'EUR', 'USD'], defaultValue: 'PLN' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'shortDescription', type: 'textarea', localized: true },
    { name: 'description', type: 'richText', localized: true },
    { name: 'categories', type: 'relationship', relationTo: 'product-categories', hasMany: true },
    {
      name: 'availability',
      type: 'select',
      defaultValue: 'inStock',
      options: ['inStock', 'outOfStock', 'preorder'],
    },
    { name: 'buyUrl', type: 'text' },
    {
      name: 'attributes',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true, localized: true },
        { name: 'value', type: 'text', required: true, localized: true },
      ],
    },
  ],
};
