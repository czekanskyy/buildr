import type { TreeNode } from '../document/tree.ts';
import type { ComponentType } from '../document/types.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { ComponentCategory, ComponentMeta } from './meta.ts';
import { validateComponentMeta } from './validate-meta.ts';

/**
 * A composite component definition (docs/templates.md, ADR-020) — the data half owned here (L2)
 * so `RegistryMeta`/`RegistryManifest` can hold and project it without depending on `templates`
 * (L3, `packages/core/src/templates`, PB-018), which owns `defineTemplate`/`instantiateTemplate`,
 * the tree-validation logic that produces one of these, and the locks/regions helpers that walk
 * it. Already fully JSON-serializable — `tree`/`variants` are ordinary `TreeNode`s.
 */
export interface TemplateDefinition {
  readonly id: string;
  readonly version: number;
  readonly label: string;
  readonly category: string;
  readonly thumbnail?: string;
  readonly lock: 'none' | 'structure';
  readonly variants?: Readonly<Record<string, TreeNode>>;
  readonly tree: TreeNode;
}

export interface RegistryMetaInput {
  readonly components: readonly ComponentMeta[];
  readonly templates?: readonly TemplateDefinition[];
}

/**
 * An immutable, explicitly-constructed registry of component and template metadata (ADR-003) —
 * no global mutable state, no side-effecting `registerComponent()`. `extend()` returns a new
 * registry rather than mutating this one.
 */
export interface RegistryMeta {
  get(type: ComponentType): ComponentMeta | undefined;
  has(type: ComponentType): boolean;
  list(): readonly ComponentMeta[];
  byCategory(category: ComponentCategory): readonly ComponentMeta[];
  getTemplate(id: string): TemplateDefinition | undefined;
  hasTemplate(id: string): boolean;
  listTemplates(): readonly TemplateDefinition[];
  extend(addition: RegistryMetaInput): RegistryMeta;
}

/**
 * Builds an immutable `RegistryMeta` from a flat list of component and template metadata
 * (ADR-003, docs/component-registry.md#registering-components). Validates at construction time —
 * every `ComponentMeta` via `validateComponentMeta`, plus registry-level duplicate checks — and
 * throws on failure: an invalid or duplicate registration is an authoring mistake made by the
 * application wiring up its registry, not bad end-user data (docs/ai/architecture-rules.md #7).
 */
export function createRegistryMeta(input: RegistryMetaInput): RegistryMeta {
  const templates = input.templates ?? [];
  const diagnostics = collectDiagnostics(input.components, templates);
  if (diagnostics.length > 0) {
    const summary = diagnostics.map((d) => `${d.code} (${d.message})`).join('; ');
    throw new Error(`createRegistryMeta: invalid registry — ${summary}`);
  }

  const components = [...input.components];
  const componentsByType = new Map(components.map((meta) => [meta.type, meta]));
  const templateList = [...templates];
  const templatesById = new Map(templateList.map((template) => [template.id, template]));

  return {
    get(type) {
      return componentsByType.get(type);
    },
    has(type) {
      return componentsByType.has(type);
    },
    list() {
      return components;
    },
    byCategory(category) {
      return components.filter((meta) => meta.category === category);
    },
    getTemplate(id) {
      return templatesById.get(id);
    },
    hasTemplate(id) {
      return templatesById.has(id);
    },
    listTemplates() {
      return templateList;
    },
    extend(addition) {
      return createRegistryMeta({
        components: [...components, ...addition.components],
        templates: [...templateList, ...(addition.templates ?? [])],
      });
    },
  };
}

function collectDiagnostics(
  components: readonly ComponentMeta[],
  templates: readonly TemplateDefinition[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const seenTypes = new Set<ComponentType>();
  for (const meta of components) {
    diagnostics.push(...validateComponentMeta(meta));
    if (seenTypes.has(meta.type)) {
      diagnostics.push({
        code: 'registry.duplicate-component-type',
        message: `component type "${meta.type}" is registered more than once`,
        severity: 'error',
        path: ['components', meta.type],
        details: { type: meta.type },
      });
    }
    seenTypes.add(meta.type);
  }

  const seenTemplateIds = new Set<string>();
  for (const template of templates) {
    if (seenTemplateIds.has(template.id)) {
      diagnostics.push({
        code: 'registry.duplicate-template-id',
        message: `template "${template.id}" is registered more than once`,
        severity: 'error',
        path: ['templates', template.id],
        details: { id: template.id },
      });
    }
    seenTemplateIds.add(template.id);
  }

  return diagnostics;
}
