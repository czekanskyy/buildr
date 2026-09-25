import type { Brief } from './types.ts';

/**
 * The briefs the agent is given. Each one is what a person would type into their client; the
 * expectations beside it are what the scorer checks. Add briefs here; nothing else changes.
 */
export const BRIEFS: readonly Brief[] = [
  {
    id: 'bakery-landing',
    prompt: 'A landing page for a bakery with a hero, three features, pricing and a contact form.',
    templates: ['buildr/hero', 'buildr/feature-grid', 'buildr/pricing', 'buildr/contact'],
    minTemplates: 3,
    locales: ['pl', 'en'],
  },
  {
    id: 'saas-marketing',
    prompt:
      'A marketing page for a project-management tool: a hero, a testimonial, a FAQ and a closing call to action.',
    templates: ['buildr/hero', 'buildr/testimonial', 'buildr/faq', 'buildr/cta'],
    minTemplates: 3,
    locales: ['pl', 'en'],
  },
  {
    id: 'company-about',
    prompt:
      'An about page for a small architecture studio: who we are, three values as cards, and how to reach us.',
    templates: ['buildr/hero', 'buildr/contact'],
    minTemplates: 1,
    locales: ['pl', 'en'],
  },
  {
    id: 'blog-listing',
    prompt: 'A blog page that lists our latest posts with pagination.',
    templates: ['buildr/blog-listing'],
    minTemplates: 1,
    locales: ['pl', 'en'],
  },
  {
    id: 'contact-only',
    prompt: 'A contact page with a short introduction and a form (name, email, message, consent).',
    templates: ['buildr/contact'],
    minTemplates: 1,
    locales: ['pl', 'en'],
  },
];
