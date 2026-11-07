/**
 * The built-in strings of the components, by locale. Site components never hard-code user-visible
 * text (AGENTS.md): they read it from here, or from `env.messages` when the site supplies its own
 * (`renderDocument({ messages })`), which wins over these.
 */
export const BUILT_IN_MESSAGES = {
  en: {
    'map.notice':
      'This map comes from Google. Loading it sends your IP address to Google, which may store data in your browser. See the site privacy policy.',
    'map.button': 'Show map',
    'map.link': 'Open in Google Maps',
    'map.newTab': 'opens in a new tab',
    'map.title': 'Map: {query}',
    'map.canvas': 'The map loads only on the published site.',
    'map.invalid': 'Invalid map query.',

    'link.newTab': 'opens in a new tab',
    'pagination.label': 'Pagination',
    'pagination.previous': 'Previous page',
    'pagination.next': 'Next page',
    'pagination.page': 'Page {page}',
    'form.honeypot': 'Leave this field empty',
    'form.sending': 'Sending…',
    'form.success': 'Thank you, your message was sent.',
    'form.error': 'Something went wrong. Please check the form and try again.',
    'video.captions': 'Captions',
    'carousel.label': 'Carousel',
    'carousel.roledescription': 'carousel',
    'carousel.slide': 'slide',
    'carousel.slideOf': 'Slide {index} of {total}',
    'carousel.previous': 'Previous slide',
    'carousel.next': 'Next slide',
    'carousel.goTo': 'Go to slide {index}',
    'carousel.slides': 'Choose a slide',
    'carousel.pause': 'Pause automatic rotation',
    'carousel.play': 'Start automatic rotation',
    'gallery.dialog': 'Image viewer',
    'gallery.close': 'Close',
    'gallery.previous': 'Previous image',
    'gallery.next': 'Next image',
    'gallery.counter': 'Image {index} of {total}',
    'gallery.openImage': 'Open image',
  },
  pl: {
    'map.notice':
      'Mapa pochodzi z Google. Po jej wczytaniu Google otrzyma Twój adres IP i może zapisać dane w przeglądarce. Szczegóły znajdziesz w polityce prywatności witryny.',
    'map.button': 'Pokaż mapę',
    'map.link': 'Otwórz w Mapach Google',
    'map.newTab': 'otwiera się w nowej karcie',
    'map.title': 'Mapa: {query}',
    'map.canvas': 'Mapa wczytuje się tylko na opublikowanej stronie.',
    'map.invalid': 'Nieprawidłowe miejsce mapy.',

    'link.newTab': 'otwiera się w nowej karcie',
    'pagination.label': 'Paginacja',
    'pagination.previous': 'Poprzednia strona',
    'pagination.next': 'Następna strona',
    'pagination.page': 'Strona {page}',
    'form.honeypot': 'Zostaw to pole puste',
    'form.sending': 'Wysyłanie…',
    'form.success': 'Dziękujemy, wiadomość została wysłana.',
    'form.error': 'Coś poszło nie tak. Sprawdź formularz i spróbuj ponownie.',
    'video.captions': 'Napisy',
    'carousel.label': 'Karuzela',
    'carousel.roledescription': 'karuzela',
    'carousel.slide': 'slajd',
    'carousel.slideOf': 'Slajd {index} z {total}',
    'carousel.previous': 'Poprzedni slajd',
    'carousel.next': 'Następny slajd',
    'carousel.goTo': 'Przejdź do slajdu {index}',
    'carousel.slides': 'Wybierz slajd',
    'carousel.pause': 'Zatrzymaj automatyczne przewijanie',
    'carousel.play': 'Włącz automatyczne przewijanie',
    'gallery.dialog': 'Przeglądarka obrazów',
    'gallery.close': 'Zamknij',
    'gallery.previous': 'Poprzedni obraz',
    'gallery.next': 'Następny obraz',
    'gallery.counter': 'Obraz {index} z {total}',
    'gallery.openImage': 'Otwórz obraz',
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, string>>>>;

export type MessageKey = keyof (typeof BUILT_IN_MESSAGES)['en'];

interface MessageEnv {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
}

/** The site's own string, else the built-in one for the locale (its language part), else English. */
export function message(env: MessageEnv, key: MessageKey): string {
  const own = Object.hasOwn(env.messages, key) ? env.messages[key] : undefined;
  if (own !== undefined) return own;
  const language = env.locale.split('-')[0] ?? 'en';
  const catalog = Object.hasOwn(BUILT_IN_MESSAGES, language)
    ? (BUILT_IN_MESSAGES as Readonly<Record<string, Readonly<Record<string, string>>>>)[language]
    : undefined;
  return catalog?.[key] ?? BUILT_IN_MESSAGES.en[key];
}
