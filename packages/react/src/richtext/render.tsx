import { type Diagnostic, MAX_RICH_TEXT_DEPTH } from '@buildr/core';
import { createElement, Fragment, type ReactNode } from 'react';
import type { Platform } from '../define/types.ts';
import {
  type RichTextConverterContext,
  type RichTextConverters,
  type RichTextJson,
  richTextConverters,
} from './converters.tsx';

/** The most nodes one call renders; more is cut and reported, so a hostile value cannot stall a render. */
export const MAX_RICH_TEXT_NODES = 20_000;

export interface RenderRichTextOptions {
  /** Routes links through `platform.Link`; without it links are plain anchors. */
  readonly platform?: Platform | undefined;
  /** Node types to add or replace, over `richTextConverters`. */
  readonly converters?: RichTextConverters | undefined;
  /** Receives every node that was dropped and every link that was refused. */
  readonly diagnostics?: Diagnostic[] | undefined;
}

function isRecord(value: unknown): value is RichTextJson {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Renders a rich text value (the validated Lexical subset of ADR-017) to React — a JSON walker,
 * never HTML: text is a React child, so it is escaped.
 * The value is treated as untrusted even when it came from `resolveProps`: node types are looked
 * up in an allowlist (an unknown one is dropped with `richtext.unknown-node`, its children with
 * it), fields are type-checked, links are sanitized, and depth and size are capped. Uses no hooks.
 * A value that is not a rich text root renders nothing.
 */
export function renderRichText(value: unknown, options: RenderRichTextOptions = {}): ReactNode {
  const converters: RichTextConverters = { ...richTextConverters, ...options.converters };
  const sink = options.diagnostics;
  const report = (diagnostic: Diagnostic): void => {
    sink?.push(diagnostic);
  };

  if (!isRecord(value) || value['type'] !== 'root') {
    if (value !== null && value !== undefined) {
      report({
        code: 'richtext.invalid',
        message: 'the value is not a rich text document',
        severity: 'warning',
      });
    }
    return null;
  }

  let budget = MAX_RICH_TEXT_NODES;

  const walk = (nodes: unknown, path: readonly (string | number)[], depth: number): ReactNode => {
    if (!Array.isArray(nodes)) return null;
    if (depth > MAX_RICH_TEXT_DEPTH) {
      report({
        code: 'richtext.max-depth',
        message: `rich text nesting exceeds the maximum depth of ${MAX_RICH_TEXT_DEPTH}`,
        severity: 'warning',
        path,
      });
      return null;
    }
    const out: ReactNode[] = [];
    nodes.forEach((child: unknown, index) => {
      const childPath = [...path, 'children', index];
      if (!isRecord(child)) return;
      if (budget <= 0) return;
      budget--;
      const type = child['type'];
      const converter =
        typeof type === 'string' && Object.hasOwn(converters, type) ? converters[type] : undefined;
      if (converter === undefined) {
        report({
          code: 'richtext.unknown-node',
          message: `unknown rich text node type "${String(type)}" was dropped`,
          severity: 'warning',
          path: childPath,
          details: { type: typeof type === 'string' ? type : '' },
        });
        return;
      }
      const ctx: RichTextConverterContext = {
        platform: options.platform,
        path: childPath,
        report,
        children: (grandchildren) => walk(grandchildren, childPath, depth + 1),
      };
      const rendered = converter(child, ctx);
      if (rendered !== null && rendered !== undefined) {
        out.push(createElement(Fragment, { key: index }, rendered));
      }
    });
    if (budget <= 0) {
      report({
        code: 'richtext.too-large',
        message: `rich text has more than ${MAX_RICH_TEXT_NODES} nodes; the rest was dropped`,
        severity: 'warning',
        path,
      });
      budget = 0;
    }
    return out;
  };

  return walk(value['children'], [], 0);
}
