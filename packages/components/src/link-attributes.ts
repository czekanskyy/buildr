import { message } from './messages/index.ts';

interface Env {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
}

export interface LinkAttributes {
  readonly target?: '_blank';
  readonly rel?: 'noopener noreferrer';
  readonly 'aria-label'?: string;
}

/**
 * What a link that opens a new tab needs: `rel` (so the new page cannot reach back), and a name
 * that says so. A link named by its visible text gets a visually hidden notice instead (see
 * `NewTabNotice`); one named by `ariaLabel` gets the notice appended to that name, because an
 * `aria-label` replaces the text.
 */
export function linkAttributes(newTab: boolean, ariaLabel: string, env: Env): LinkAttributes {
  const named = ariaLabel !== '';
  const notice = message(env, 'link.newTab');
  return {
    ...(newTab ? ({ target: '_blank', rel: 'noopener noreferrer' } as const) : {}),
    ...(named ? { 'aria-label': newTab ? `${ariaLabel} (${notice})` : ariaLabel } : {}),
  };
}

/** The hidden text for a new-tab link whose name comes from its visible content. */
export function newTabNotice(newTab: boolean, ariaLabel: string, env: Env): string | undefined {
  return newTab && ariaLabel === '' ? ` (${message(env, 'link.newTab')})` : undefined;
}
