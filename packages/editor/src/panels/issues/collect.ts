import type {
  A11yFix,
  A11yIssue,
  BuilderDocument,
  Diagnostic,
  NodeId,
  ValidationIssue,
} from '@next-buildr/core';

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueSource = 'validation' | 'a11y' | 'canvas';

/** One row of the Issues panel: a finding of any of the checks, in one shape. */
export interface IssueItem {
  readonly key: string;
  readonly source: IssueSource;
  readonly severity: IssueSeverity;
  /** The rule or the diagnostic code. */
  readonly code: string;
  readonly message: string;
  readonly help?: string | undefined;
  /** The node it is about, when it is about one that is still in the document. */
  readonly nodeId?: NodeId | undefined;
  /** The document must not be saved or published while it exists. */
  readonly blocking: boolean;
  readonly fix?: A11yFix | undefined;
  /** The language a finding was made in (`missing-translation`); absent for the ones that do not depend on it. */
  readonly locale?: string | undefined;
}

const RANK: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

/** The node a diagnostic is about: the one its path points into, else the one it names in `details`. */
export function nodeOfDiagnostic(diagnostic: Diagnostic): NodeId | undefined {
  const [head, id] = diagnostic.path ?? [];
  if (head === 'nodes' && typeof id === 'string') return id;
  const named = diagnostic.details?.['nodeId'];
  return typeof named === 'string' ? named : undefined;
}

export interface CollectInput {
  readonly doc: BuilderDocument;
  readonly validation?: readonly ValidationIssue[] | undefined;
  readonly a11y?: readonly A11yIssue[] | undefined;
  /** What the canvas reported (a component that threw, a binding that failed at render). */
  readonly canvas?: readonly Diagnostic[] | undefined;
}

/**
 * Merges the findings of validation, the accessibility rules and the canvas into one list: worst
 * first, then in the order the checks reported them. A finding about a node that is gone keeps its
 * text but loses its node, so clicking it does nothing rather than selecting a stale id.
 */
export function collectIssues(input: CollectInput): IssueItem[] {
  const { doc } = input;
  const known = (id: NodeId | undefined) =>
    id !== undefined && Object.hasOwn(doc.nodes, id) ? id : undefined;
  const items: IssueItem[] = [];
  for (const [index, issue] of (input.validation ?? []).entries()) {
    items.push({
      key: `validation:${index}`,
      source: 'validation',
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      nodeId: known(nodeOfDiagnostic(issue)),
      blocking: issue.blocking,
    });
  }
  for (const [index, issue] of (input.a11y ?? []).entries()) {
    items.push({
      key: `a11y:${index}`,
      source: 'a11y',
      severity: issue.severity,
      code: issue.ruleId,
      message: issue.message,
      help: issue.help,
      nodeId: known(issue.nodeId),
      blocking: false,
      fix: issue.fix,
      locale: issue.locale,
    });
  }
  for (const [index, issue] of (input.canvas ?? []).entries()) {
    items.push({
      key: `canvas:${index}`,
      source: 'canvas',
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      nodeId: known(nodeOfDiagnostic(issue)),
      blocking: false,
    });
  }
  // `sort` is stable, so the order the checks gave is kept within a severity.
  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

export type SeverityFilter = 'all' | IssueSeverity;

export function filterIssues(items: readonly IssueItem[], filter: SeverityFilter): IssueItem[] {
  return filter === 'all' ? [...items] : items.filter((item) => item.severity === filter);
}

export interface IssueCounts {
  readonly all: number;
  readonly error: number;
  readonly warning: number;
  readonly info: number;
}

export function countIssues(items: readonly IssueItem[]): IssueCounts {
  const counts = { all: items.length, error: 0, warning: 0, info: 0 };
  for (const item of items) counts[item.severity] += 1;
  return counts;
}

export type PublishPolicy = 'warn' | 'block';

export interface PublishGate {
  /** Publishing is not allowed. */
  readonly blocked: boolean;
  /** Why: a corrupt document always blocks; errors block under the `block` policy. */
  readonly reason: 'blocking' | 'errors' | undefined;
  readonly counts: IssueCounts;
}

/**
 * Whether the findings allow publishing. A blocking validation issue (a corrupt structure) stops
 * it under any policy; under `publishPolicy: 'block'` so does any error, from validation or from
 * the accessibility rules. Under `'warn'` (the default) the author is told and may go on.
 */
export function publishGate(
  items: readonly IssueItem[],
  policy: PublishPolicy = 'warn',
): PublishGate {
  const counts = countIssues(items);
  if (items.some((item) => item.blocking)) return { blocked: true, reason: 'blocking', counts };
  if (policy === 'block' && counts.error > 0) return { blocked: true, reason: 'errors', counts };
  return { blocked: false, reason: undefined, counts };
}

/** The rule that flags a translatable text with no translation; the panel lists its findings per language. */
export const MISSING_TRANSLATION = 'missing-translation';

export interface MissingGroup {
  readonly locale: string;
  readonly items: readonly IssueItem[];
}

/** Splits the findings into the ordinary ones and the missing translations, those grouped by language in the order the languages first appear. */
export function groupMissingTranslations(items: readonly IssueItem[]): {
  readonly rest: readonly IssueItem[];
  readonly groups: readonly MissingGroup[];
} {
  const rest: IssueItem[] = [];
  const byLocale = new Map<string, IssueItem[]>();
  for (const item of items) {
    if (item.code !== MISSING_TRANSLATION || item.locale === undefined) {
      rest.push(item);
      continue;
    }
    const list = byLocale.get(item.locale) ?? [];
    list.push(item);
    byLocale.set(item.locale, list);
  }
  return { rest, groups: [...byLocale].map(([locale, list]) => ({ locale, items: list })) };
}
