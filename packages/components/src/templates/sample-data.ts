import type { DataContext } from '@next-buildr/core';

const text = (value: string) => ({ type: 'text', version: 1, text: value, format: 0 });
const paragraph = (value: string) => ({
  type: 'paragraph',
  version: 1,
  children: [text(value)],
});
const richText = (...paragraphs: string[]) => ({
  type: 'root',
  version: 1,
  children: paragraphs.map(paragraph),
});

const image = (id: string, url: string, alt: string) => ({
  id,
  url,
  alt,
  width: 1600,
  height: 900,
  mimeType: 'image/jpeg',
});

/**
 * Sample content for the templates that bind to a collection's document (`post`, `product`) or to
 * a list of them. It is what the gallery and the tests render them against; a real site gets the
 * same shapes from its data source.
 */
export const templateSampleScopes: DataContext['scopes'] = {
  post: {
    title: 'Building pages from data',
    publishedAt: '2026-03-14T09:30:00.000Z',
    featuredImage: image('m1', '/media/desk.jpg', 'A desk with a laptop'),
    author: {
      name: 'Ada Example',
      jobTitle: 'Editor',
      bio: 'Writes about how sites are made.',
      avatar: image('a1', '/media/ada.jpg', 'Ada Example'),
    },
    content: richText(
      'The first paragraph of the article.',
      'The second paragraph of the article.',
    ),
  },
  product: {
    title: 'Desk lamp',
    price: 49.5,
    currency: 'USD',
    shortDescription: 'A lamp that lights a desk and nothing else.',
    description: richText('Made of metal, with a warm light.', 'Comes with a two-year guarantee.'),
    buyUrl: 'https://shop.example.com/desk-lamp',
    images: [
      image('p1', '/media/lamp-1.jpg', 'The lamp, switched on'),
      image('p2', '/media/lamp-2.jpg', 'The lamp, from above'),
    ],
    attributes: [
      { name: 'Material', value: 'Steel' },
      { name: 'Height', value: '45 cm' },
      { name: 'Weight', value: '1.2 kg' },
    ],
  },
  route: { path: '/blog', params: { page: '1' }, locale: 'en' },
};

/** The `posts` collection the listing queries. */
export const templateSampleCollections = {
  posts: Array.from({ length: 8 }, (_, i) => ({
    id: `post-${i + 1}`,
    title: `Post number ${i + 1}`,
    excerpt: `A short summary of post ${i + 1}.`,
    path: `/blog/post-${i + 1}`,
    publishedAt: new Date(Date.UTC(2026, 2, 20 - i)).toISOString(),
    featuredImage: image(`f${i + 1}`, `/media/post-${i + 1}.jpg`, `Picture for post ${i + 1}`),
  })),
};
