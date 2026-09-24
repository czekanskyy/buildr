import type { DocumentIndex } from '../document/document-index.ts';
import type {
  BuilderDocument,
  ComponentType,
  LocaleCode,
  NodeId,
  PageNode,
} from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { EffectiveStyles } from '../styles/effective.ts';

export type A11ySeverity = 'error' | 'warning' | 'info';

/**
 * A suggested repair, shaped like a `Command` (`{ type, payload }`) but declared here so `a11y`
 * does not depend on `commands`. The editor executes it as-is; it is only ever offered when the
 * fix is unambiguous.
 */
export interface A11yFix {
  readonly type: string;
  readonly payload: unknown;
}

export interface A11yIssue {
  readonly ruleId: string;
  readonly severity: A11ySeverity;
  readonly nodeId: NodeId;
  readonly message: string;
  readonly help?: string;
  /** The language the issue was found in; absent for rules that do not depend on the language. */
  readonly locale?: LocaleCode;
  readonly fix?: A11yFix;
}

export interface A11yConfig {
  /**
   * Who renders the page's `<h1>`: `'layout'` (default — the page template around the document,
   * so the document itself need not have one) or `'document'` (the document must contain exactly
   * one).
   */
  readonly expectH1: 'layout' | 'document';
  /** Rule ids that must not run. */
  readonly disabledRules: readonly string[];
  /** Read by the Payload publish hook, not by the validator itself. */
  readonly publishPolicy?: 'warn' | 'block';
}

export const DEFAULT_A11Y_CONFIG: A11yConfig = { expectH1: 'layout', disabledRules: [] };

/** What a rule knows about a prop: a value it can rely on, or `unknown` (bound to data, no sample). */
export type PropRead<T> = { readonly known: true; readonly value: T } | { readonly known: false };

export interface A11yContext {
  readonly doc: BuilderDocument;
  readonly index: DocumentIndex;
  readonly registry: RegistryMeta;
  readonly config: A11yConfig;
  /** The language being checked (the default language when no `LocaleConfig` was given). */
  readonly locale: LocaleCode;
  readonly defaultLocale: LocaleCode;
  /** Whether a missing translation shows the default-language text. */
  readonly fallback: boolean;

  /** Every reachable node, in render order. */
  nodes(): readonly PageNode[];
  /** Nodes `rule` applies to, in render order: its `appliesTo` types plus components listing it in `a11y.rules`. */
  nodesFor(rule: A11yRule): readonly PageNode[];
  meta(node: PageNode): ComponentMeta | undefined;
  /** The value of a prop for this language — the instance's value, else the component's default. */
  read(node: PageNode, prop: string): PropRead<unknown>;
  text(node: PageNode, prop: string): PropRead<string>;
  flag(node: PageNode, prop: string): PropRead<boolean>;
  number(node: PageNode, prop: string): PropRead<number>;
  /** Children of `node` across all slots, in order. */
  children(node: PageNode): readonly PageNode[];
  /** Every descendant of `node`, in render order. */
  descendants(node: PageNode): readonly PageNode[];
  /** Ancestors from the parent up to the root. */
  ancestors(node: PageNode): readonly PageNode[];
  effectiveStyles(nodeId: NodeId, bp: string): EffectiveStyles;
}

export interface A11yRule {
  readonly id: string;
  readonly severity: A11ySeverity;
  readonly appliesTo?: readonly ComponentType[] | '*';
  /** Depends on the language of the content, so it runs once per configured language. */
  readonly perLocale?: boolean;
  check(ctx: A11yContext): readonly A11yIssue[];
}
