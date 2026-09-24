import type { TemplateDefinition } from '@buildr/core';
import { Contact } from './contact.ts';
import { Cta } from './cta.ts';
import { Faq } from './faq.ts';
import { FeatureGrid } from './feature-grid.ts';
import { Hero } from './hero.ts';
import { Pricing } from './pricing.ts';
import { Testimonial } from './testimonial.ts';

export { Contact, Cta, Faq, FeatureGrid, Hero, Pricing, Testimonial };

/** The marketing templates, in the order the inserter lists them. */
export const marketingTemplates: readonly TemplateDefinition[] = [
  Hero,
  FeatureGrid,
  Cta,
  Testimonial,
  Pricing,
  Faq,
  Contact,
];
