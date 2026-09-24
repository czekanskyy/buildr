import { createIndex } from '../document/document-index.ts';
import type { BuilderDocument, LocaleCode, NodeId, PageNode } from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { effectiveStyles } from '../styles/effective.ts';
import { defaultTheme, type Theme } from '../styles/theme.ts';
import type { A11yConfig, A11yContext, A11yRule, PropRead } from './types.ts';

const UNKNOWN: PropRead<never> = { known: false };
const known = <T>(value: T): PropRead<T> => ({ known: true, value });

export interface A11yContextInput {
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  readonly config: A11yConfig;
  readonly locale: LocaleCode;
  readonly defaultLocale: LocaleCode;
  readonly fallback: boolean;
  readonly theme?: Theme | undefined;
}

/**
 * The read side rules share. A value that comes from data (a binding or an expression) is
 * `unknown` — the validator has no visitor's data — and rules must not report on what they cannot
 * see, which is what keeps false positives out.
 */
export function createA11yContext(input: A11yContextInput): A11yContext {
  const { doc, registry, config, locale } = input;
  const index = createIndex(doc);
  const theme = input.theme ?? defaultTheme;
  const all = index.order.flatMap((id) => {
    const node = doc.nodes[id];
    return node === undefined ? [] : [node];
  });

  const node = (id: NodeId): PageNode | undefined => doc.nodes[id];
  const meta = (n: PageNode): ComponentMeta | undefined => registry.get(n.type);

  const children = (n: PageNode): PageNode[] =>
    Object.values(n.slots ?? {}).flatMap((ids) => ids.flatMap((id) => node(id) ?? []));

  const descendants = (n: PageNode): PageNode[] => {
    const out: PageNode[] = [];
    const visit = (parent: PageNode): void => {
      for (const child of children(parent)) {
        out.push(child);
        visit(child);
      }
    };
    visit(n);
    return out;
  };

  const ancestors = (n: PageNode): PageNode[] => {
    const out: PageNode[] = [];
    for (let id = index.parentOf[n.id]; id !== undefined; id = index.parentOf[id]) {
      const parent = node(id);
      if (parent === undefined) break;
      out.push(parent);
    }
    return out;
  };

  const read = (n: PageNode, prop: string): PropRead<unknown> => {
    const m = meta(n);
    const def = m !== undefined && Object.hasOwn(m.props, prop) ? m.props[prop] : undefined;
    if (def === undefined) return UNKNOWN; // the component has no such prop: nothing to judge
    const raw = n.props !== undefined && Object.hasOwn(n.props, prop) ? n.props[prop] : undefined;
    if (raw === undefined) return known(def.default);
    if (raw.kind !== 'static') return UNKNOWN;
    if (def.localizable && locale !== input.defaultLocale && raw.l10n !== undefined) {
      if (Object.hasOwn(raw.l10n, locale)) return known(raw.l10n[locale]);
    }
    if (def.localizable && locale !== input.defaultLocale && !input.fallback) {
      return known(undefined); // no translation and no fallback: the visitor sees nothing
    }
    return known(raw.value);
  };

  const typed =
    <T>(check: (value: unknown) => value is T) =>
    (n: PageNode, prop: string): PropRead<T> => {
      const value = read(n, prop);
      return value.known && check(value.value) ? known(value.value) : UNKNOWN;
    };
  const text = typed((v): v is string => typeof v === 'string');

  return {
    doc,
    index,
    registry,
    config,
    locale,
    defaultLocale: input.defaultLocale,
    fallback: input.fallback,
    nodes: () => all,
    nodesFor(rule: A11yRule) {
      return all.filter((n) => {
        if (rule.appliesTo === undefined || rule.appliesTo === '*') return true;
        if (rule.appliesTo.includes(n.type)) return true;
        return meta(n)?.a11y?.rules?.includes(rule.id) === true;
      });
    },
    meta,
    read,
    text: (n, prop) => {
      const value = read(n, prop);
      if (!value.known) return UNKNOWN;
      if (value.value === undefined || value.value === null) return known('');
      return text(n, prop);
    },
    flag: typed((v): v is boolean => typeof v === 'boolean'),
    number: typed((v): v is number => typeof v === 'number'),
    children,
    descendants,
    ancestors,
    effectiveStyles: (id, bp) => {
      const n = node(id);
      return n?.styles === undefined ? {} : effectiveStyles(n.styles, bp, theme.breakpoints);
    },
  };
}
