/**
 * The built-in strings of the components, by locale. Site components never hard-code user-visible
 * text (AGENTS.md): they read it from here, or from `env.messages` when the site supplies its own
 * (`renderDocument({ messages })`), which wins over these.
 */
export const BUILT_IN_MESSAGES = {
  en: {
    'link.newTab': 'opens in a new tab',
    'pagination.label': 'Pagination',
    'pagination.previous': 'Previous page',
    'pagination.next': 'Next page',
    'pagination.page': 'Page {page}',
  },
  pl: {
    'link.newTab': 'otwiera się w nowej karcie',
    'pagination.label': 'Paginacja',
    'pagination.previous': 'Poprzednia strona',
    'pagination.next': 'Następna strona',
    'pagination.page': 'Strona {page}',
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
