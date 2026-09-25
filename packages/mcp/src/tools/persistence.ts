// Persistence tools (PB-138, docs/mcp.md#validate-save-and-publish): `save`, `publish` and
// `get_preview_url`. The rules: a save that conflicts never overwrites (the agent reopens and
// re-applies); a rejected save maps the server's diagnostics to nodes; publish is opt-in, needs
// `confirm: true` and respects the site's `publishPolicy`.
import type { Diagnostic } from '@buildr/core';
import { z } from 'zod';
import type { McpError } from '../backend.ts';
import type { McpTool, McpToolResult } from '../server.ts';
import type { EditSession } from '../session/index.ts';
import {
  backendFailureResult,
  errorResult,
  parseArguments,
  requireSession,
  sessionIdSchema,
  type ToolFactoryOptions,
  textResult,
} from './documents.ts';
import {
  collectQuality,
  formatIssue,
  nodeOfDiagnostic,
  publishGate,
  type QualityIssue,
} from './quality.ts';

export interface PersistenceToolOptions extends ToolFactoryOptions {
  /**
   * The server operator's opt-in (`--allow-publish`, the plugin's `mcp.allowPublish`). `publish` is
   * only registered when this is true AND `canPublish` is true.
   */
  readonly allowPublish?: boolean;
  /**
   * What the backend session reported for `permissions.canPublish` when the tools were built. The
   * tool list is fixed at server creation (`listChanged: false`) and reading the session is
   * asynchronous, so the caller resolves it once (`createBuildrTools` does) and passes it in. It is
   * a registration filter only: `publish` re-reads the session on every call and refuses when the
   * permission is gone, and the backend re-checks it too. Default false: no publish tool.
   */
  readonly canPublish?: boolean;
}

const MAX_DIAGNOSTICS = 20;

interface MappedDiagnostic {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly nodeType?: string;
}

/** Server diagnostics against the node they are about (when it exists in the working copy). */
function mapDiagnostics(
  session: EditSession,
  diagnostics: readonly Diagnostic[],
): MappedDiagnostic[] {
  return diagnostics.map((d) => {
    const id = nodeOfDiagnostic(d);
    const known = id !== undefined && Object.hasOwn(session.doc.nodes, id) ? id : undefined;
    return {
      code: d.code,
      severity: d.severity,
      message: d.message,
      ...(known === undefined
        ? {}
        : { nodeId: known, nodeType: session.doc.nodes[known]?.type as string }),
    };
  });
}

function formatMapped(items: readonly MappedDiagnostic[]): string {
  const lines = items
    .slice(0, MAX_DIAGNOSTICS)
    .map(
      (d) =>
        `[${d.severity}] ${d.nodeId ? `${d.nodeId}${d.nodeType ? ` ${d.nodeType}` : ''}` : 'document'} ${d.code}: ${d.message}`,
    );
  if (items.length > MAX_DIAGNOSTICS) lines.push(`... and ${items.length - MAX_DIAGNOSTICS} more.`);
  return lines.join('\n');
}

/** A backend refusal of `save` or `publish`, explained so the agent knows what to do next. */
function refusal(session: EditSession, verb: 'save' | 'publish', error: McpError): McpToolResult {
  switch (error.code) {
    case 'conflict':
      return errorResult(
        [
          `Not ${verb === 'save' ? 'saved' : 'published'}: someone else changed this document (it is now at revision ${error.currentRevision}, your working copy is based on revision ${session.revision}). Nothing was overwritten.`,
          'To continue: keep a note of your changes (get_outline), close_document with discard true, open_document again to load the current revision, re-apply your changes, then run validate and try again.',
        ].join('\n'),
        {
          error: {
            code: 'conflict',
            message: error.message,
            currentRevision: error.currentRevision,
            baseRevision: session.revision,
          },
        },
      );
    case 'invalid': {
      const mapped = mapDiagnostics(session, error.diagnostics);
      return errorResult(
        [
          `Not ${verb === 'save' ? 'saved' : 'published'}: the server rejected the document. ${error.message}`,
          formatMapped(mapped),
          'Fix these with the editing tools (get_node shows a node in full), run validate, then try again.',
        ]
          .filter((line) => line.length > 0)
          .join('\n'),
        { error: { code: 'invalid', message: error.message, diagnostics: mapped } },
      );
    }
    case 'forbidden':
      return errorResult(
        `Not ${verb === 'save' ? 'saved' : 'published'}: ${error.message} This is a permission of the signed-in agent user; retrying will not help.`,
        { error: { code: 'forbidden', message: error.message } },
      );
    case 'network':
      return errorResult(
        `${error.message} The ${verb} may not have happened; ${error.retryable ? 'wait a moment and try again' : 'do not retry until the connection problem is fixed'}. Your working copy is unchanged.`,
        { error: { code: 'network', message: error.message, retryable: error.retryable } },
      );
    default:
      return backendFailureResult(error);
  }
}

// --- save -------------------------------------------------------------------------------------------

const saveArgs = z.object({ sessionId: sessionIdSchema });

function saveTool({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'save',
    description:
      "Saves the working copy of an open document as the DRAFT (it never publishes). The save is built on the revision the document was opened at: if somebody else saved in the meantime nothing is written and you are told to reopen the document and re-apply your changes, so another writer's work is never lost. If the server rejects the document, its problems are listed per node. Run validate first.",
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string', description: 'sessionId of the open document' } },
      required: ['sessionId'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Save the draft',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async handler(args, { backend }) {
      const parsed = parseArguments(saveArgs, args);
      if (!parsed.ok) return parsed.error;
      // A save is allowed for a session whose manifest changed: the backend validates it anyway.
      const found = await requireSession(store, parsed.value.sessionId, { ignoreManifest: true });
      if (!found.ok) return found.error;
      const session = found.value;
      if (session.readOnly) {
        return errorResult('This document is read-only for the current user; it cannot be saved.', {
          error: { code: 'read-only', message: 'read-only' },
        });
      }
      if (!session.dirty) {
        return textResult(
          `Nothing to save: the working copy has no changes since revision ${session.revision}.`,
          { sessionId: session.id, saved: false, revision: session.revision, dirty: false },
        );
      }
      const saved = await backend.save(session.ref, session.doc, session.revision);
      if (!saved.ok) return refusal(session, 'save', saved.error);
      session.markSaved(saved.value);
      return textResult(
        `Saved ${session.ref.collection}/${session.ref.id} as a draft at revision ${saved.value.revision}. It is not published.`,
        {
          sessionId: session.id,
          saved: true,
          revision: saved.value.revision,
          updatedAt: saved.value.updatedAt,
          dirty: session.dirty,
        },
      );
    },
  };
}

// --- publish ----------------------------------------------------------------------------------------

const publishArgs = z.object({
  sessionId: sessionIdSchema,
  confirm: z.boolean().optional(),
});

const MAX_BLOCKING_LISTED = 10;

function publishTool({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'publish',
    description:
      'Publishes the saved draft of an open document: it goes LIVE on the site. Only available because the operator enabled publishing and the user may publish. Requires confirm: true, which you may only set after the user explicitly asked to publish this document. Unsaved changes must be saved first. When the site\'s publish policy is "block", a document with validation or accessibility errors is refused and the errors are listed.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        confirm: {
          type: 'boolean',
          description:
            'Must be true. Only set it when the user explicitly asked to publish this document.',
        },
      },
      required: ['sessionId', 'confirm'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Publish the document',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async handler(args, { backend }) {
      const parsed = parseArguments(publishArgs, args);
      if (!parsed.ok) return parsed.error;
      if (parsed.value.confirm !== true) {
        return errorResult(
          'Publishing needs confirm: true, and only once the user explicitly asked to publish this document. Nothing was published.',
          { error: { code: 'confirmation-required', message: 'confirm must be true' } },
        );
      }
      const site = await backend.getSession();
      if (!site.ok) return backendFailureResult(site.error);
      if (!site.value.permissions.canPublish) {
        return errorResult(
          'Publishing is not allowed for the signed-in user. Nothing was published; ask a person with publish rights.',
          { error: { code: 'forbidden', message: 'canPublish is false' } },
        );
      }
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      const session = found.value;
      if (session.dirty) {
        return errorResult(
          'The working copy has unsaved changes and publish only publishes the saved draft. Run validate, then save, then publish again. Nothing was published.',
          { error: { code: 'unsaved-changes', message: 'save first' } },
        );
      }
      const report = await collectQuality(session, backend);
      const gate = publishGate(report, site.value.publishPolicy);
      if (gate.blocked) {
        const blockers: QualityIssue[] = report.issues.filter((issue) =>
          gate.reason === 'blocking' ? issue.blocking : issue.severity === 'error',
        );
        const lines = blockers.slice(0, MAX_BLOCKING_LISTED).map(formatIssue);
        if (blockers.length > MAX_BLOCKING_LISTED) {
          lines.push(`... and ${blockers.length - MAX_BLOCKING_LISTED} more.`);
        }
        return errorResult(
          [
            gate.reason === 'blocking'
              ? 'Refused: the document has a structural problem and cannot be published.'
              : `Refused: the site's publish policy is "block" and the document has ${report.counts.error} error(s). Nothing was published.`,
            ...lines,
            'Fix them with the editing tools, save, run validate and publish again.',
          ].join('\n'),
          {
            error: {
              code: 'publish-blocked',
              message: 'validation errors under publishPolicy block',
            },
            policy: site.value.publishPolicy ?? 'warn',
            counts: report.counts,
            issues: blockers.slice(0, 50),
          },
        );
      }
      const published = await backend.publish(session.ref, session.revision);
      if (!published.ok) return refusal(session, 'publish', published.error);
      session.markSaved({ revision: published.value.revision });
      const warnings = report.counts.error + report.counts.warning;
      return textResult(
        `Published ${session.ref.collection}/${session.ref.id} at ${published.value.publishedAt} (revision ${published.value.revision}).${warnings > 0 ? ` It still had ${report.counts.error} error(s) and ${report.counts.warning} warning(s) (policy "warn").` : ''}`,
        {
          sessionId: session.id,
          published: true,
          publishedAt: published.value.publishedAt,
          revision: published.value.revision,
          counts: report.counts,
        },
      );
    },
  };
}

// --- get_preview_url --------------------------------------------------------------------------------

const previewArgs = z.object({
  sessionId: sessionIdSchema,
  locale: z.string().min(1).max(35).optional(),
});

function previewTool({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'get_preview_url',
    description:
      'Returns the URL where the document can be viewed (a person opens it in a browser). It shows the saved draft, not unsaved changes, so save first. Optionally for one language of the site. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        locale: { type: 'string', description: "A language of the site; default: the session's." },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Get the preview URL',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(args, { backend }) {
      const parsed = parseArguments(previewArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId, { ignoreManifest: true });
      if (!found.ok) return found.error;
      const session = found.value;
      const locale = parsed.value.locale ?? session.locale;
      const url = await backend.previewUrl(session.ref, locale);
      if (!url.ok) return backendFailureResult(url.error);
      if (url.value === null) {
        return textResult('This document has no public path, so there is nothing to preview.', {
          sessionId: session.id,
          url: null,
        });
      }
      return textResult(
        `${url.value}${session.dirty ? '\nThe working copy has unsaved changes; the page shows the last saved draft.' : ''}`,
        { sessionId: session.id, url: url.value, dirty: session.dirty },
      );
    },
  };
}

/**
 * `save` and `get_preview_url`, plus `publish` when both `allowPublish` and `canPublish` are true
 * (see `PersistenceToolOptions`).
 */
export function createPersistenceTools(options: PersistenceToolOptions): McpTool[] {
  const tools = [saveTool(options), previewTool(options)];
  if (options.allowPublish === true && options.canPublish === true)
    tools.push(publishTool(options));
  return tools;
}
