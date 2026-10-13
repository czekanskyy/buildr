import type { MessageKey, Translate } from '../../messages/index.tsx';

const titleCase = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

const KNOWN = ['layout', 'content', 'media', 'ui', 'forms', 'cms'] as const;

/** The heading of a category: its catalog string, or the title-cased id for a custom category. */
export function categoryName(t: Translate, category: string): string {
  return (KNOWN as readonly string[]).includes(category)
    ? t(`insert.category.${category}` as MessageKey)
    : titleCase(category);
}
