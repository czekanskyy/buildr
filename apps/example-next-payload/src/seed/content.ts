/** The demo content of the example site, in Polish (the default language) and English. */

export interface Bilingual<T = string> {
  readonly pl: T;
  readonly en: T;
}

export const SITE = {
  siteName: { pl: 'Buildr', en: 'Buildr' },
  socials: [{ label: 'GitHub', url: 'https://github.com/czekanskyy/buildr' }],
} as const;

export interface MediaSpec {
  readonly key: string;
  /** Hue of the placeholder picture (0-360). */
  readonly hue: number;
  readonly alt: Bilingual;
  readonly caption?: Bilingual;
}

export const MEDIA: readonly MediaSpec[] = [
  {
    key: 'team',
    hue: 210,
    alt: { pl: 'Zespół przy wspólnym stole', en: 'The team around a shared table' },
  },
  {
    key: 'post-1',
    hue: 20,
    alt: { pl: 'Kolorowe bloki układane w stronę', en: 'Colourful blocks arranged into a page' },
  },
  {
    key: 'post-2',
    hue: 140,
    alt: { pl: 'Przełącznik języka na ekranie', en: 'A language switcher on a screen' },
  },
  {
    key: 'post-3',
    hue: 280,
    alt: { pl: 'Telefon i komputer obok siebie', en: 'A phone and a laptop side by side' },
  },
  { key: 'product-1', hue: 0, alt: { pl: 'Notes z siatką kropek', en: 'A dot-grid notebook' } },
  { key: 'product-2', hue: 45, alt: { pl: 'Ceramiczny kubek', en: 'A ceramic mug' } },
  { key: 'product-3', hue: 190, alt: { pl: 'Płócienna torba', en: 'A canvas tote bag' } },
];

export interface AuthorSpec {
  readonly slug: string;
  readonly name: string;
  readonly avatar: string;
  readonly jobTitle: Bilingual;
  readonly bio: Bilingual;
}

export const AUTHORS: readonly AuthorSpec[] = [
  {
    slug: 'anna-nowak',
    name: 'Anna Nowak',
    avatar: 'team',
    jobTitle: { pl: 'Redaktorka naczelna', en: 'Editor in chief' },
    bio: {
      pl: 'Pisze o tym, jak zespoły treści pracują ze stronami bez czekania na programistów.',
      en: 'Writes about how content teams work with pages without waiting for developers.',
    },
  },
  {
    slug: 'piotr-wisniewski',
    name: 'Piotr Wiśniewski',
    avatar: 'team',
    jobTitle: { pl: 'Inżynier frontendu', en: 'Frontend engineer' },
    bio: {
      pl: 'Buduje komponenty i dba o to, żeby każda strona była szybka i dostępna.',
      en: 'Builds components and makes sure every page is fast and accessible.',
    },
  },
];

export interface TaxonomySpec {
  readonly slug: Bilingual;
  readonly title: Bilingual;
  readonly description: Bilingual;
}

export const CATEGORIES: readonly TaxonomySpec[] = [
  {
    slug: { pl: 'poradniki', en: 'guides' },
    title: { pl: 'Poradniki', en: 'Guides' },
    description: { pl: 'Krok po kroku.', en: 'Step by step.' },
  },
  {
    slug: { pl: 'nowosci', en: 'news' },
    title: { pl: 'Nowości', en: 'News' },
    description: { pl: 'Co słychać w Buildr.', en: 'What is new in Buildr.' },
  },
];

export const PRODUCT_CATEGORIES: readonly TaxonomySpec[] = [
  {
    slug: { pl: 'akcesoria', en: 'accessories' },
    title: { pl: 'Akcesoria', en: 'Accessories' },
    description: { pl: 'Drobiazgi na biurko.', en: 'Small things for the desk.' },
  },
  {
    slug: { pl: 'dom', en: 'home' },
    title: { pl: 'Dom', en: 'Home' },
    description: { pl: 'Na co dzień.', en: 'For every day.' },
  },
];

export interface PostSpec {
  readonly slug: Bilingual;
  readonly title: Bilingual;
  readonly excerpt: Bilingual;
  readonly body: Bilingual<readonly string[]>;
  readonly author: string;
  readonly category: number;
  readonly image: string;
  /** Days before the seed date, so the listing has a stable order. */
  readonly daysAgo: number;
}

const post = (n: number, category: number, author: string, image: string): PostSpec => ({
  slug: { pl: `wpis-${n}`, en: `post-${n}` },
  title: {
    pl: `Wpis numer ${n}: strony bez tajemnic`,
    en: `Post number ${n}: pages without mystery`,
  },
  excerpt: {
    pl: `Krótkie streszczenie wpisu numer ${n} o układaniu stron w Buildr.`,
    en: `A short summary of post number ${n} about arranging pages in Buildr.`,
  },
  body: {
    pl: [
      `To jest pierwszy akapit wpisu numer ${n}. Opowiada o tym, jak złożyć stronę z gotowych sekcji.`,
      'Drugi akapit pokazuje, jak przetłumaczyć treść i sprawdzić ją na telefonie, zanim trafi do czytelników.',
    ],
    en: [
      `This is the first paragraph of post number ${n}. It explains how to put a page together from ready-made sections.`,
      'The second paragraph shows how to translate the content and check it on a phone before it reaches readers.',
    ],
  },
  author,
  category,
  image,
  daysAgo: n * 3,
});

// Eight posts: with six per listing page, the second page exists and pagination has something to do.
export const POSTS: readonly PostSpec[] = [
  post(1, 0, 'anna-nowak', 'post-1'),
  post(2, 1, 'piotr-wisniewski', 'post-2'),
  post(3, 0, 'anna-nowak', 'post-3'),
  post(4, 1, 'piotr-wisniewski', 'post-1'),
  post(5, 0, 'anna-nowak', 'post-2'),
  post(6, 1, 'piotr-wisniewski', 'post-3'),
  post(7, 0, 'anna-nowak', 'post-1'),
  post(8, 1, 'piotr-wisniewski', 'post-2'),
];

export interface ProductSpec {
  readonly slug: Bilingual;
  readonly title: Bilingual;
  readonly sku: string;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly shortDescription: Bilingual;
  readonly description: Bilingual<readonly string[]>;
  readonly images: readonly string[];
  readonly category: number;
  readonly availability: 'inStock' | 'outOfStock' | 'preorder';
  readonly attributes: readonly { name: Bilingual; value: Bilingual }[];
}

export const PRODUCTS: readonly ProductSpec[] = [
  {
    slug: { pl: 'notes-kropkowany', en: 'dot-grid-notebook' },
    title: { pl: 'Notes kropkowany', en: 'Dot-grid notebook' },
    sku: 'NOTE-001',
    price: 39,
    shortDescription: {
      pl: 'Twarda okładka i papier, który nie przebija.',
      en: 'A hard cover and paper that does not bleed through.',
    },
    description: {
      pl: ['Notes formatu A5 z siatką kropek, idealny do szkiców stron i planów.'],
      en: ['An A5 notebook with a dot grid, ideal for page sketches and plans.'],
    },
    images: ['product-1'],
    category: 0,
    availability: 'inStock',
    attributes: [
      { name: { pl: 'Format', en: 'Size' }, value: { pl: 'A5', en: 'A5' } },
      { name: { pl: 'Kartki', en: 'Pages' }, value: { pl: '160', en: '160' } },
    ],
  },
  {
    slug: { pl: 'kubek-ceramiczny', en: 'ceramic-mug' },
    title: { pl: 'Kubek ceramiczny', en: 'Ceramic mug' },
    sku: 'MUG-001',
    price: 49,
    compareAtPrice: 59,
    shortDescription: {
      pl: 'Pojemność 350 ml, można myć w zmywarce.',
      en: '350 ml, dishwasher safe.',
    },
    description: {
      pl: ['Ręcznie glazurowany kubek, który dobrze leży w dłoni.'],
      en: ['A hand-glazed mug that sits well in the hand.'],
    },
    images: ['product-2'],
    category: 1,
    availability: 'inStock',
    attributes: [
      { name: { pl: 'Pojemność', en: 'Capacity' }, value: { pl: '350 ml', en: '350 ml' } },
      { name: { pl: 'Materiał', en: 'Material' }, value: { pl: 'Ceramika', en: 'Ceramic' } },
    ],
  },
  {
    slug: { pl: 'torba-plocienna', en: 'canvas-tote-bag' },
    title: { pl: 'Torba płócienna', en: 'Canvas tote bag' },
    sku: 'BAG-001',
    price: 69,
    shortDescription: {
      pl: 'Mocna torba na laptopa i zakupy.',
      en: 'A sturdy bag for a laptop and groceries.',
    },
    description: {
      pl: ['Gruba bawełna, wzmocnione uchwyty i kieszeń wewnętrzna.'],
      en: ['Thick cotton, reinforced handles and an inside pocket.'],
    },
    images: ['product-3'],
    category: 1,
    availability: 'preorder',
    attributes: [
      { name: { pl: 'Materiał', en: 'Material' }, value: { pl: 'Bawełna', en: 'Cotton' } },
    ],
  },
  {
    slug: { pl: 'zestaw-biurkowy', en: 'desk-set' },
    title: { pl: 'Zestaw biurkowy', en: 'Desk set' },
    sku: 'SET-001',
    price: 129,
    shortDescription: {
      pl: 'Notes, kubek i torba w jednym pudełku.',
      en: 'A notebook, a mug and a bag in one box.',
    },
    description: {
      pl: ['Wszystko, czego potrzeba na pierwszy dzień w nowej pracy.'],
      en: ['Everything you need for the first day at a new job.'],
    },
    images: ['product-1', 'product-2', 'product-3'],
    category: 0,
    availability: 'outOfStock',
    attributes: [],
  },
];
