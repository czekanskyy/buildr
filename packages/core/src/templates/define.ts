import type { TreeNode } from '../document/tree.ts';
import type { TemplateDefinition } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';

/**
 * Checks a `TemplateDefinition` for the self-consistency invariants that don't need a live
 * registry to evaluate (docs/templates.md, ADR-020) — whether a referenced component type
 * actually exists is only knowable at `createRegistryMeta` time (and later, per-insertion, via
 * `canInsert`), so it isn't checked here (mirrors `validateComponentMeta`'s scope, PB-014). Pure
 * and non-throwing (docs/ai/architecture-rules.md #7); `defineTemplate` is what surfaces this to
 * the author.
 */
export function validateTemplateDefinition(input: TemplateDefinition): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  checkVersion(input, diagnostics);
  checkTree(input, 'tree', input.tree, diagnostics);
  for (const [variantName, variantTree] of Object.entries(input.variants ?? {})) {
    checkTree(input, `variants.${variantName}`, variantTree, diagnostics);
  }

  return diagnostics;
}

function checkVersion(input: TemplateDefinition, diagnostics: Diagnostic[]): void {
  if (Number.isInteger(input.version) && input.version >= 1) return;
  diagnostics.push({
    code: 'template.invalid-version',
    message: `template "${input.id}" has version ${input.version}, expected an integer >= 1`,
    severity: 'error',
    path: ['version'],
    details: { id: input.id, version: input.version },
  });
}

/**
 * Walks one tree (the main `tree` or one `variants` entry) looking for a duplicate `anchor` or
 * `region` — each is meant to identify a single node within the template, so two nodes claiming
 * the same one is an authoring mistake (an ambiguous `isInsideRegion` escape hatch, or a document
 * that would fail `checkInvariants`'s own duplicate-anchor check the moment it's instantiated).
 */
function checkTree(
  input: TemplateDefinition,
  path: string,
  tree: TreeNode,
  diagnostics: Diagnostic[],
): void {
  const anchors = new Map<string, number>();
  const regions = new Map<string, number>();

  function visit(node: TreeNode): void {
    if (node.anchor !== undefined) anchors.set(node.anchor, (anchors.get(node.anchor) ?? 0) + 1);
    if (node.region !== undefined) regions.set(node.region, (regions.get(node.region) ?? 0) + 1);

    const slotsSpec = node.slots ?? (node.children ? { default: node.children } : undefined);
    for (const children of Object.values(slotsSpec ?? {})) {
      for (const child of children) visit(child);
    }
  }
  visit(tree);

  for (const [anchor, count] of anchors) {
    if (count <= 1) continue;
    diagnostics.push({
      code: 'template.duplicate-anchor',
      message: `template "${input.id}" (${path}) uses anchor "${anchor}" on ${count} nodes`,
      severity: 'error',
      path: [path],
      details: { id: input.id, anchor, count },
    });
  }
  for (const [region, count] of regions) {
    if (count <= 1) continue;
    diagnostics.push({
      code: 'template.duplicate-region',
      message: `template "${input.id}" (${path}) uses region "${region}" on ${count} nodes`,
      severity: 'error',
      path: [path],
      details: { id: input.id, region, count },
    });
  }
}

/**
 * Validates and returns `input` as a `TemplateDefinition` (docs/templates.md,
 * docs/component-registry.md#composite-components-templates) — the typed constructor a component
 * library calls at module-load time, alongside `defineComponent`, before handing everything to
 * `createRegistryMeta`. Throws on an invalid definition: like `createRegistryMeta`, this is an
 * authoring mistake made by whoever is building the registry, not bad end-user data
 * (docs/ai/architecture-rules.md #7).
 */
export function defineTemplate(input: TemplateDefinition): TemplateDefinition {
  const diagnostics = validateTemplateDefinition(input);
  if (diagnostics.length > 0) {
    const summary = diagnostics.map((d) => `${d.code} (${d.message})`).join('; ');
    throw new Error(`defineTemplate: invalid template "${input.id}" — ${summary}`);
  }
  return input;
}
