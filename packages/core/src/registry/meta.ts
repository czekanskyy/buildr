import type { TreeNode } from '../document/tree.ts';
import type { ComponentType, SlotName } from '../document/types.ts';
import type { PropDef } from '../schema/kinds/index.ts';
import type { ContentCategory, Matcher } from './matchers.ts';

/**
 * The high-level palette grouping shown in the editor's component picker
 * (docs/component-registry.md#metadata-vs-implementation). Deliberately open — application authors
 * register custom components under their own category without touching `@next-buildr/core`.
 */
export type ComponentCategory =
  | 'layout'
  | 'content'
  | 'media'
  | 'ui'
  | 'forms'
  | 'cms'
  | (string & {});

/**
 * Which groups of style properties the inspector shows for a node of this type
 * (docs/styles.md#model) — a subset of `StyleDecl`'s own top-level keys.
 */
export type StyleGroupId =
  | 'layout'
  | 'size'
  | 'spacing'
  | 'typography'
  | 'background'
  | 'border'
  | 'effects'
  | 'visibility';

/** One named slot a component accepts children into (docs/component-registry.md#metadata-vs-implementation). */
export interface SlotDef {
  readonly label?: string;
  readonly allow?: readonly Matcher[];
  readonly deny?: readonly Matcher[];
  readonly min?: number;
  readonly max?: number;
  /** Drag-and-drop hint; `'auto'` reads the axis off the slot's own computed `display`/`flex-direction`. */
  readonly axis?: 'vertical' | 'horizontal' | 'auto';
}

export interface ParentRules {
  readonly allow?: readonly Matcher[];
  readonly deny?: readonly Matcher[];
  /** The node is only valid nested somewhere under one of these matchers (e.g. a form control). */
  readonly requireAncestor?: readonly Matcher[];
}

export interface ComponentCapabilities {
  readonly insertable?: boolean;
  readonly draggable?: boolean;
  readonly removable?: boolean;
  readonly duplicable?: boolean;
  /** May sit at the document root (docs/document-model.md#invariants — only `buildr/page` does). */
  readonly root?: boolean;
}

/** Accessibility metadata driving the a11y validator and the editor (docs/accessibility.md). */
export interface A11yMeta {
  /** The rendered element, or a semantic-prop-driven range, e.g. `"h1-h6"`. */
  readonly element: string;
  readonly role?: string;
  readonly landmark?: boolean;
  readonly requiresName?: boolean;
  /** `A11yRule.id`s (`core/a11y`) that apply to this component beyond the global rule set. */
  readonly rules?: readonly string[];
}

export interface EditorMeta {
  /** The prop name driving inline (in-canvas) text editing. */
  readonly inlineProp?: string;
  readonly placeholder?: string;
  readonly revealOnSelect?: boolean;
  readonly emptySlotText?: Readonly<Record<SlotName, string>>;
}

/** How this component derives a form field's schema (docs/components.md#forms). */
export interface FormFieldMeta {
  readonly valueType: 'string' | 'email' | 'tel' | 'url' | 'number' | 'boolean' | 'enum';
  readonly nameProp: string;
  readonly requiredProp?: string;
  readonly maxLengthProp?: string;
  readonly optionsProp?: string;
}

/**
 * The serializable half of a component definition (docs/component-registry.md#metadata-vs-
 * implementation, ADR-003). The editor's palette, inspector and drag-and-drop rules — and
 * Payload's document validation — are built from this alone; it reaches the editor as part of a
 * `RegistryManifest` (`toManifest`, PB-015) and carries no functions. The React implementation
 * (`render`, `runtime`, `migrations`) is a separate, non-serializable half defined in
 * `@next-buildr/react` (`defineComponent`, PB-044).
 */
export interface ComponentMeta {
  /** `<namespace>/<name>`, e.g. `"buildr/heading"`, `"acme/pricing-table"`. */
  readonly type: ComponentType;
  /** The prop schema version this metadata describes (docs/migrations.md); `>= 1`. */
  readonly version: number;
  readonly label: string;
  readonly description?: string;
  readonly keywords?: readonly string[];
  readonly category: ComponentCategory;
  readonly icon?: string;
  readonly props: Readonly<Record<string, PropDef>>;
  /** Absent means a leaf component — it accepts no children. */
  readonly slots?: Readonly<Record<SlotName, SlotDef>>;
  /** The HTML content-model categories this component belongs to as a *child* of another. */
  readonly contentCategories: readonly ContentCategory[];
  readonly parents?: ParentRules;
  readonly capabilities?: ComponentCapabilities;
  readonly styles: { readonly groups: readonly StyleGroupId[] };
  readonly a11y?: A11yMeta;
  readonly editor?: EditorMeta;
  readonly formField?: FormFieldMeta;
  /** Children inserted together with a new node of this type. */
  readonly defaults?: { readonly slots?: Readonly<Record<SlotName, readonly TreeNode[]>> };
  /** `'shared'` renders identically in RSC and the client; `'client'` requires a `'use client'` module. */
  readonly runtime: 'shared' | 'client';
}
