// Quality tool (PB-138, docs/mcp.md#validate-save-and-publish): `validate` runs everything core knows
// about a document (structure, nesting, props, bindings, styles, accessibility, missing
// translations) and reports every finding against a node, with a call that would fix it. The same
// check gates `publish` (see persistence.ts).
import {
  type A11yIssue,
  type BuilderDocument,
  type DataSchema,
  type Diagnostic,
  runA11y,
  type Theme,
  type ValidationIssue,
  validateDocument,
} from '@buildr/core';
import { z } from 'zod';
import type { McpBackend } from '../backend.ts';
import type { McpTool } from '../server.ts';
import type { EditSession } from '../session/index.ts';
import {
  parseArguments,
  requireSession,
  sessionIdSchema,
  type ToolFactoryOptions,
  textResult,
} from './documents.ts';

export type QualitySeverity = 'error' | 'warning' | 'info';
export type QualitySource = 'validation' | 'a11y';

/** A tool call (name + arguments) that would repair a finding. */
export interface SuggestedCall {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
}

/** One finding, in the shape the agent reads. */
export interface QualityIssue {
  readonly source: QualitySource;
  readonly severity: QualitySeverity;
  /** The rule id or diagnostic code. */
  readonly code: string;
  readonly message: string;
  /** The node it is about; absent for document-level findings or nodes that no longer exist. */
  readonly nodeId?: string;
  /** The component type of `nodeId`. */
  readonly nodeType?: string | undefined;
  /** The language a finding was made in (missing translations, content rules). */
  readonly locale?: string;
  /** A structural problem: stops saving and publishing under any policy. */
  readonly blocking: boolean;
  readonly help?: string;
  /** A concrete call that fixes it, when one is unambiguous. */
  readonly suggestedCall?: SuggestedCall;
  /** Guidance in words when no single call fixes it. */
  readonly suggestion?: string;
}

export interface QualityReport {
  readonly issues: readonly QualityIssue[];
  readonly counts: Readonly<Record<QualitySeverity, number>>;
  /** True when at least one finding is blocking. */
  readonly blocking: boolean;
}

const RANK: Record<QualitySeverity, number> = { error: 0, warning: 1, info: 2 };

/** The node a diagnostic is about: the one its path points into, else the one `details` names. */
export function nodeOfDiagnostic(diagnostic: Diagnostic): string | undefined {
  const [head, id] = diagnostic.path ?? [];
  if (head === 'nodes' && typeof id === 'string') return id;
  const named = diagnostic.details?.['nodeId'];
  return typeof named === 'string' ? named : undefined;
}

/** The prop a diagnostic path points at (`['nodes', id, 'props', name, ...]`). */
function propOfDiagnostic(diagnostic: Diagnostic): string | undefined {
  const path = diagnostic.path ?? [];
  const at = path.indexOf('props');
  const name = at >= 0 ? path[at + 1] : undefined;
  return typeof name === 'string' ? name : undefined;
}

function suggestionFor(
  session: EditSession,
  input: {
    readonly source: QualitySource;
    readonly code: string;
    readonly nodeId: string | undefined;
    readonly prop?: string | undefined;
    readonly locale?: string | undefined;
    readonly fix?: { readonly type: string; readonly payload: unknown } | undefined;
  },
): Pick<QualityIssue, 'suggestedCall' | 'suggestion'> {
  const { nodeId } = input;
  if (input.fix !== undefined) {
    return {
      suggestedCall: {
        tool: 'apply_commands',
        args: {
          sessionId: session.id,
          commands: [{ type: input.fix.type, payload: input.fix.payload }],
        },
      },
    };
  }
  if (nodeId === undefined) return {};
  if (input.code === 'missing-translation' && input.locale !== undefined) {
    return {
      suggestedCall: {
        tool: 'update_node',
        args: { sessionId: session.id, nodeId, locale: input.locale, props: {} },
      },
      suggestion: `Translate the text into "${input.locale}": put the translated value for each localizable prop under props.`,
    };
  }
  if (input.prop !== undefined) {
    return {
      suggestedCall: { tool: 'get_node', args: { sessionId: session.id, nodeId } },
      suggestion: `Read the node, then fix the "${input.prop}" prop with update_node (or reset it with unsetProps).`,
    };
  }
  return { suggestedCall: { tool: 'get_node', args: { sessionId: session.id, nodeId } } };
}

function fromValidation(session: EditSession, issue: ValidationIssue): QualityIssue {
  const known = nodeOfDiagnostic(issue);
  const nodeId = known !== undefined && Object.hasOwn(session.doc.nodes, known) ? known : undefined;
  const prop = propOfDiagnostic(issue);
  return {
    source: 'validation',
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    ...(nodeId === undefined
      ? {}
      : { nodeId, nodeType: session.doc.nodes[nodeId]?.type as string | undefined }),
    blocking: issue.blocking,
    ...suggestionFor(session, { source: 'validation', code: issue.code, nodeId, prop }),
  };
}

function fromA11y(session: EditSession, issue: A11yIssue): QualityIssue {
  const nodeId = Object.hasOwn(session.doc.nodes, issue.nodeId) ? issue.nodeId : undefined;
  return {
    source: 'a11y',
    severity: issue.severity,
    code: issue.ruleId,
    message: issue.message,
    ...(nodeId === undefined
      ? {}
      : { nodeId, nodeType: session.doc.nodes[nodeId]?.type as string | undefined }),
    ...(issue.locale === undefined ? {} : { locale: issue.locale }),
    blocking: false,
    ...(issue.help === undefined ? {} : { help: issue.help }),
    ...suggestionFor(session, {
      source: 'a11y',
      code: issue.ruleId,
      nodeId,
      locale: issue.locale,
      fix: issue.fix,
    }),
  };
}

/**
 * Checks the working copy: `validateDocument` (against the site's theme, languages and, when the
 * backend has one, the collection's data schema) plus the accessibility rules, which include the
 * missing-translation rule for every language of the site. The accessibility `expectH1` setting is
 * the default (`layout`): the backend does not expose it per collection.
 */
export async function collectQuality(
  session: EditSession,
  backend: McpBackend,
): Promise<QualityReport> {
  const site = await backend.getSession();
  const locales = site.ok ? site.value.locales : undefined;
  const themed = await backend.getTheme();
  const theme: Theme | undefined = themed.ok ? themed.value : undefined;
  const dataSchema = await backend.getDataSchema(session.ref.collection);
  const schema: DataSchema | undefined = dataSchema.ok ? dataSchema.value : undefined;

  const doc: BuilderDocument = session.doc;
  const validation = validateDocument(doc, {
    registry: session.registry,
    theme,
    locales,
    dataSchema: schema,
  });
  const found: QualityIssue[] = validation.issues.map((issue) => fromValidation(session, issue));
  // A corrupt structure cannot be walked by the accessibility rules.
  if (!validation.issues.some((issue) => issue.blocking)) {
    for (const issue of runA11y(doc, session.registry, { locales, theme })) {
      found.push(fromA11y(session, issue));
    }
  }
  // `sort` is stable: the order the checks reported is kept within a severity.
  const issues = found.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return { issues, counts, blocking: issues.some((issue) => issue.blocking) };
}

/**
 * Whether the site's publish policy lets a document with these findings go live: a blocking
 * (structural) issue stops it under any policy, an error stops it under `block`.
 */
export function publishGate(
  report: QualityReport,
  policy: 'warn' | 'block' | undefined,
): { readonly blocked: boolean; readonly reason?: 'blocking' | 'errors' } {
  if (report.blocking) return { blocked: true, reason: 'blocking' };
  if (policy === 'block' && report.counts.error > 0) return { blocked: true, reason: 'errors' };
  return { blocked: false };
}

const MAX_LISTED = 40;

export function formatIssue(issue: QualityIssue): string {
  const where =
    issue.nodeId === undefined
      ? 'document'
      : `${issue.nodeId}${issue.nodeType ? ` ${issue.nodeType}` : ''}`;
  const fix = issue.suggestedCall
    ? ` -> ${issue.suggestedCall.tool} ${JSON.stringify(issue.suggestedCall.args)}`
    : '';
  const locale = issue.locale ? ` [${issue.locale}]` : '';
  return `[${issue.severity}] ${where} ${issue.code}${locale}: ${issue.message}${fix}`;
}

export function formatReport(report: QualityReport, limit = MAX_LISTED): string {
  const { error, warning, info } = report.counts;
  const head =
    report.issues.length === 0
      ? 'No issues found.'
      : `${error} error(s), ${warning} warning(s), ${info} info.${report.blocking ? ' A structural problem blocks saving and publishing.' : ''}`;
  const lines = report.issues.slice(0, limit).map(formatIssue);
  if (report.issues.length > limit) lines.push(`... and ${report.issues.length - limit} more.`);
  return [head, ...lines].join('\n');
}

const validateArgs = z.object({
  sessionId: sessionIdSchema,
  severity: z
    .enum(['error', 'warning', 'info'])
    .optional()
    .describe('Only report findings of at least this severity (default: everything).'),
});

function validateTool({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'validate',
    description:
      'Checks the working copy of an open document: structure, nesting, prop values, bindings, styles, accessibility and missing translations for every language of the site. Every finding names its node, a severity and, when there is an unambiguous repair, a suggested tool call. Read-only; run it before save and publish. Errors do not stop a save, but under the site\'s "block" publish policy they stop publish.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'info'],
          description: 'Only report findings of at least this severity (default: everything).',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Validate a document',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(args, { backend }) {
      const parsed = parseArguments(validateArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      const report = await collectQuality(found.value, backend);
      const floor = parsed.value.severity === undefined ? 2 : RANK[parsed.value.severity];
      const shown = report.issues.filter((issue) => RANK[issue.severity] <= floor);
      const filtered: QualityReport = { ...report, issues: shown };
      return textResult(formatReport(filtered), {
        sessionId: found.value.id,
        ok: report.counts.error === 0 && !report.blocking,
        blocking: report.blocking,
        counts: report.counts,
        issues: shown.slice(0, 200),
        truncated: shown.length > 200,
      });
    },
  };
}

/** `validate`. */
export function createQualityTools(options: ToolFactoryOptions): McpTool[] {
  return [validateTool(options)];
}
