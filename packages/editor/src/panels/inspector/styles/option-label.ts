import { en } from '../../../messages/en.ts';
import type { MessageKey, Translate } from '../../../messages/index.tsx';

/**
 * The words an author reads for a CSS keyword (`flex-start`, `nowrap`, `multiply`). The stored
 * value stays the keyword; only what is shown is translated. A keyword without a message shows as it is.
 */
export function optionLabel(keyword: string, t: Translate): string {
  const key = `styleOption.kw.${keyword.trim().replaceAll(' ', '-')}`;
  return Object.hasOwn(en, key) ? t(key as MessageKey) : keyword;
}
