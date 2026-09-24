import { createIndex, type DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { checkPlacement } from '../rules/can-insert.ts';
import type { ContentModelNode } from '../rules/content-model.ts';
import type { ValidationIssue } from './types.ts';

function issue(
  code: string,
  message: string,
  nodeId: NodeId,
  blocking: boolean,
  extra: Record<string, string | number> = {},
): ValidationIssue {
  return {
    code,
    message,
    severity: 'error',
    blocking,
    path: ['nodes', nodeId],
    details: { nodeId, ...extra },
  };
}

/**
 * Every component type in use must be registered, and its recorded version must match the
 * registry's. A document written by *newer* code (version ahead) cannot be interpreted and is
 * blocking; an older one is only outdated (a migration should have run), and an unregistered type
 * renders as a placeholder rather than failing.
 */
export function checkVersions(doc: BuilderDocument, registry: RegistryMeta): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (seen.has(node.type)) continue;
    seen.add(node.type);
    const meta = registry.get(node.type);
    if (meta === undefined) {
      issues.push(
        issue(
          'validation.unknown-component',
          `"${node.type}" is not a registered component.`,
          id,
          false,
          {
            type: node.type,
          },
        ),
      );
      continue;
    }
    const recorded = Object.hasOwn(doc.components, node.type)
      ? doc.components[node.type]
      : undefined;
    if (recorded === undefined) {
      issues.push(
        issue(
          'validation.missing-component-version',
          `The document does not record a version for "${node.type}".`,
          id,
          true,
          {
            type: node.type,
          },
        ),
      );
    } else if (recorded > meta.version) {
      issues.push(
        issue(
          'validation.component-version-ahead',
          `"${node.type}" is version ${recorded} in the document but this application only knows version ${meta.version}.`,
          id,
          true,
          { type: node.type, recorded, known: meta.version },
        ),
      );
    } else if (recorded < meta.version) {
      issues.push(
        issue(
          'validation.component-outdated',
          `"${node.type}" is version ${recorded} in the document; the current version is ${meta.version}.`,
          id,
          false,
          { type: node.type, recorded, known: meta.version },
        ),
      );
    }
  }
  return issues;
}

/** The parent first, then its ancestors up to the root. */
function ancestorChain(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  startId: NodeId,
): ContentModelNode[] {
  const chain: ContentModelNode[] = [];
  for (
    let current: NodeId | undefined = startId;
    current !== undefined;
    current = index.parentOf[current]
  ) {
    const node = doc.nodes[current];
    if (node === undefined) break;
    chain.push({ type: node.type, categories: registry.get(node.type)?.contentCategories ?? [] });
  }
  return chain;
}

/**
 * The nesting rules applied to the structure that already exists: each node against its slot's
 * `allow`/`deny`, its own `parents.*`, `requireAncestor`, the global HTML content model, and each
 * slot's `min`/`max`. The same `checkPlacement` that `canInsert` uses, so a document built by
 * commands never fails here.
 */
export function checkNesting(
  doc: BuilderDocument,
  registry: RegistryMeta,
  index: DocumentIndex = createIndex(doc),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const id of index.order) {
    const node = doc.nodes[id];
    if (node === undefined) continue;
    const meta = registry.get(node.type);
    if (meta === undefined) continue; // reported as an unknown component

    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      const slotDef = meta.slots?.[slotName];
      if (slotDef === undefined) {
        issues.push(
          issue('validation.unknown-slot', `${meta.label} has no "${slotName}" slot.`, id, false, {
            slot: slotName,
          }),
        );
        continue;
      }
      if (slotDef.min !== undefined && children.length < slotDef.min) {
        issues.push(
          issue(
            'validation.slot-min',
            `"${slotName}" needs at least ${slotDef.min} item(s).`,
            id,
            false,
            {
              slot: slotName,
              min: slotDef.min,
            },
          ),
        );
      }
      if (slotDef.max !== undefined && children.length > slotDef.max) {
        issues.push(
          issue(
            'validation.slot-max',
            `"${slotName}" takes at most ${slotDef.max} item(s).`,
            id,
            false,
            {
              slot: slotName,
              max: slotDef.max,
            },
          ),
        );
      }
    }

    const parentId = index.parentOf[id];
    const slot = index.slotOf[id];
    if (parentId === undefined || slot === undefined) continue;
    const parentNode = doc.nodes[parentId];
    const parentMeta = parentNode ? registry.get(parentNode.type) : undefined;
    const slotDef = parentMeta?.slots?.[slot];
    if (parentNode === undefined || parentMeta === undefined || slotDef === undefined) continue;

    const violation = checkPlacement({
      registry,
      parentNode,
      parentMeta,
      slot,
      slotDef,
      type: node.type,
      meta,
      ancestorChain: ancestorChain(doc, index, registry, parentId),
      enforceInsertable: false,
    });
    if (violation !== undefined) {
      issues.push(
        issue(`validation.${violation.code}`, violation.message, id, false, { parentId, slot }),
      );
    }
  }
  return issues;
}
