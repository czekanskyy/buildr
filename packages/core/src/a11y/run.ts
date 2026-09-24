import type { BuilderDocument, LocaleCode } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Theme } from '../styles/theme.ts';
import type { LocaleConfig } from '../values/types.ts';
import { createA11yContext } from './context.ts';
import { mvpA11yRules } from './rules/index.ts';
import { type A11yConfig, type A11yIssue, type A11yRule, DEFAULT_A11Y_CONFIG } from './types.ts';

export interface RunA11yOptions {
  readonly config?: Partial<A11yConfig> | undefined;
  /**
   * The site's languages. Rules that depend on content (`image-alt`, `missing-translation`, …) run
   * once per language and tag each issue with it; without this, only the default language exists.
   */
  readonly locales?: LocaleConfig | undefined;
  readonly theme?: Theme | undefined;
  /** Defaults to `mvpA11yRules`; custom rules are appended by passing `[...mvpA11yRules, mine]`. */
  readonly rules?: readonly A11yRule[] | undefined;
}

const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Statically checks a document for accessibility problems (docs/accessibility.md). Pure and
 * synchronous; a value bound to data is never judged, since the validator has no visitor's data.
 * Issues come back in render order, then rule order. Never throws for bad data: a rule that throws
 * is a bug in the rule, reported as an `a11y-internal` issue on the root rather than losing the rest.
 */
export function runA11y(
  doc: BuilderDocument,
  registry: RegistryMeta,
  options: RunA11yOptions = {},
): A11yIssue[] {
  const config: A11yConfig = { ...DEFAULT_A11Y_CONFIG, ...options.config };
  const rules = (options.rules ?? mvpA11yRules).filter((r) => !config.disabledRules.includes(r.id));
  const defaultLocale = options.locales?.default ?? DEFAULT_LOCALE;
  const locales = options.locales?.locales ?? [defaultLocale];
  const fallback = options.locales?.fallback ?? true;

  const issues: A11yIssue[] = [];
  const contexts = new Map<LocaleCode, ReturnType<typeof createA11yContext>>();
  const contextFor = (locale: LocaleCode) => {
    let ctx = contexts.get(locale);
    if (ctx === undefined) {
      ctx = createA11yContext({
        doc,
        registry,
        config,
        locale,
        defaultLocale,
        fallback,
        theme: options.theme,
      });
      contexts.set(locale, ctx);
    }
    return ctx;
  };

  for (const rule of rules) {
    const languages = rule.perLocale ? locales : [defaultLocale];
    for (const locale of languages) {
      try {
        issues.push(...rule.check(contextFor(locale)));
      } catch (error) {
        issues.push({
          ruleId: 'a11y-internal',
          severity: 'warning',
          nodeId: doc.root,
          message: `The "${rule.id}" rule failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  const order = new Map(
    contextFor(defaultLocale).index.order.map((id, position) => [id, position]),
  );
  const position = (issue: A11yIssue): number => order.get(issue.nodeId) ?? Number.MAX_SAFE_INTEGER;
  const ruleIndex = new Map(rules.map((rule, i) => [rule.id, i]));
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort(
      (a, b) =>
        position(a.issue) - position(b.issue) ||
        (ruleIndex.get(a.issue.ruleId) ?? 0) - (ruleIndex.get(b.issue.ruleId) ?? 0) ||
        a.i - b.i,
    )
    .map(({ issue }) => issue);
}
