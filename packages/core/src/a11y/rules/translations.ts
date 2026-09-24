import type { PageNode } from '../../document/types.ts';
import type { A11yIssue, A11yRule } from '../types.ts';
import { isBlank, issue } from './helpers.ts';

/** Kinds that carry words a visitor reads; a URL or a media reference is not "translated" text. */
const TRANSLATED_KINDS: readonly string[] = ['text', 'textarea', 'richText'];

function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return !isBlank(value);
  return value !== undefined && value !== null;
}

function missing(node: PageNode, prop: string, locale: string): boolean {
  const raw = node.props?.[prop];
  if (raw === undefined) return false;
  if (raw.kind === 'static') {
    return hasContent(raw.value) && !(raw.l10n !== undefined && Object.hasOwn(raw.l10n, locale));
  }
  if (raw.kind === 'expression' && raw.mode === 'template') {
    return hasContent(raw.expr) && !(raw.l10n !== undefined && Object.hasOwn(raw.l10n, locale));
  }
  return false; // a binding is localized by the data source itself
}

export const missingTranslation: A11yRule = {
  id: 'missing-translation',
  severity: 'info',
  appliesTo: '*',
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    if (ctx.locale === ctx.defaultLocale) return out; // the default language is the source text
    for (const node of ctx.nodesFor(this)) {
      const meta = ctx.meta(node);
      if (meta === undefined) continue;
      for (const [prop, def] of Object.entries(meta.props)) {
        if (!def.localizable || !TRANSLATED_KINDS.includes(def.kind)) continue;
        if (!missing(node, prop, ctx.locale)) continue;
        out.push(
          issue(this, ctx, node, `"${def.label ?? prop}" is not translated to ${ctx.locale}.`, {
            help: ctx.fallback
              ? 'The default-language text is shown until it is translated.'
              : 'Nothing is shown in this language until it is translated.',
          }),
        );
      }
    }
    return out;
  },
};
