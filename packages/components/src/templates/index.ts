import type { TemplateDefinition } from '@buildr/core';
import { AuthorBox } from './author-box.ts';
import { BlogListing } from './blog-listing.ts';
import { Contact } from './contact.ts';
import { Cta } from './cta.ts';
import { Faq } from './faq.ts';
import { FeatureGrid } from './feature-grid.ts';
import { Hero } from './hero.ts';
import { PostCard } from './post-card.ts';
import { PostContent } from './post-content.ts';
import { PostHeader } from './post-header.ts';
import { Pricing } from './pricing.ts';
import { ProductDetails } from './product-details.ts';
import { ProductHero } from './product-hero.ts';
import { Testimonial } from './testimonial.ts';

export {
  AuthorBox,
  BlogListing,
  Contact,
  Cta,
  Faq,
  FeatureGrid,
  Hero,
  PostCard,
  PostContent,
  PostHeader,
  Pricing,
  ProductDetails,
  ProductHero,
  Testimonial,
};

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

/**
 * Templates for a collection's document (a post, a product) or a list of them. They bind to
 * `post.*`, `product.*`, `item.*` and `loop.*`, so they only make sense where that data exists.
 */
export const contentTemplates: readonly TemplateDefinition[] = [
  PostHeader,
  PostContent,
  AuthorBox,
  PostCard,
  BlogListing,
  ProductHero,
  ProductDetails,
];
