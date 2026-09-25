// The data a scored run consists of. It is exactly what the MCP tools return (`get_outline` with
// `format: "json"`, `validate`), so the scorer needs neither the model nor `@buildr/core`.

/** One node of the `get_outline` JSON. */
export interface OutlineEntry {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  /** The node's primary text prop; absent for nodes that have none or whose text is bound. */
  readonly text?: string;
  readonly textKind?: 'binding' | 'expression';
  /** Languages that carry a translation of the primary text. */
  readonly translations?: readonly string[];
  /** The template the node came from (the id, on the template's root). */
  readonly template?: string;
  readonly hiddenDescendants?: number;
  readonly slots?: Readonly<Record<string, readonly OutlineEntry[]>>;
}

/** One finding of `validate`. */
export interface QualityIssue {
  readonly source: 'validation' | 'a11y';
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly locale?: string;
}

/** One tool call the agent made. */
export interface ToolCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly isError: boolean;
}

export interface Brief {
  readonly id: string;
  /** What the user asks for. */
  readonly prompt: string;
  /** Template ids that fit this brief (any of them counts). */
  readonly templates: readonly string[];
  /** How many of `templates` a good page uses. */
  readonly minTemplates: number;
  /** Languages the page must be complete in; the first is the site default. */
  readonly locales: readonly string[];
}

/** What the harness collected after the agent finished. */
export interface RunRecord {
  readonly brief: Brief;
  /** The languages of the site the run happened on (one language: the locale rule does not apply). */
  readonly siteLocales: readonly string[];
  /** The saved page's outline root, reopened from the backend after the run. */
  readonly outline: OutlineEntry;
  readonly issues: readonly QualityIssue[];
  /** Every tool call of the agent, in order. */
  readonly calls: readonly ToolCall[];
}

export type RuleId =
  | 'saved'
  | 'validates'
  | 'a11y-clean'
  | 'uses-templates'
  | 'no-empty-slots'
  | 'both-locales';

export interface RuleResult {
  readonly rule: RuleId;
  /** `null`: the rule does not apply to this run and is left out of the score. */
  readonly passed: boolean | null;
  readonly detail: string;
}

export interface Score {
  readonly brief: string;
  readonly rules: readonly RuleResult[];
  /** Passed rules over applicable rules, 0..1. */
  readonly score: number;
}
