import type { CollectionConfig } from 'payload';
import { isSignedIn, readAll } from '../access.ts';
import { slugField } from '../fields.ts';

const taxonomy = (slug: 'categories' | 'product-categories'): CollectionConfig => ({
  slug,
  admin: { useAsTitle: 'title' },
  access: { read: readAll, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'description', type: 'textarea', localized: true },
    { name: 'parent', type: 'relationship', relationTo: slug },
  ],
});

export const Categories = taxonomy('categories');
export const ProductCategories = taxonomy('product-categories');
