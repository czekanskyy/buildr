import type { GlobalConfig } from 'payload';
import { isSignedIn, readAll } from '../access.ts';

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: readAll, update: isSignedIn },
  fields: [
    { name: 'siteName', type: 'text', required: true, localized: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'timeZone', type: 'text', defaultValue: 'Europe/Warsaw' },
    {
      name: 'defaultCurrency',
      type: 'select',
      options: ['PLN', 'EUR', 'USD'],
      defaultValue: 'PLN',
    },
    {
      name: 'social',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
};
