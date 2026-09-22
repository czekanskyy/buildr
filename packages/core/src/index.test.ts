import { describe, expect, it } from 'vitest';
import * as core from './index.ts';

describe('@buildr/core public API', () => {
  it('exports the PB-006 primitives', () => {
    expect(typeof core.generateId).toBe('function');
    expect(typeof core.createSeededIdGenerator).toBe('function');
    expect(typeof core.isJsonValue).toBe('function');
    expect(typeof core.stableStringify).toBe('function');
    expect(typeof core.hash).toBe('function');
    expect(typeof core.ok).toBe('function');
    expect(typeof core.err).toBe('function');
  });

  it('exports the PB-007 document primitives', () => {
    expect(typeof core.createEmptyDocument).toBe('function');
    expect(typeof core.parseDocument).toBe('function');
    expect(typeof core.documentSchema.safeParse).toBe('function');
    expect(typeof core.pageNodeSchema.safeParse).toBe('function');
    expect(core.DEFAULT_DOCUMENT_LIMITS.maxNodes).toBe(5000);
    expect(core.ROOT_COMPONENT_TYPE).toBe('buildr/page');
  });

  it('exports the PB-008 document index and traversal primitives', () => {
    expect(typeof core.createIndex).toBe('function');
    expect(typeof core.walk).toBe('function');
    expect(typeof core.ancestors).toBe('function');
    expect(typeof core.descendants).toBe('function');
    expect(typeof core.subtreeIds).toBe('function');
    expect(typeof core.isAncestor).toBe('function');
    expect(typeof core.pathTo).toBe('function');
  });

  it('exports the PB-009 invariants primitives', () => {
    expect(typeof core.checkInvariants).toBe('function');
    expect(typeof core.assertDocumentInvariants).toBe('function');
  });

  it('exports the PB-010 authoring format and fragment primitives', () => {
    expect(typeof core.fromTree).toBe('function');
    expect(typeof core.toTree).toBe('function');
    expect(typeof core.extractFragment).toBe('function');
    expect(typeof core.reId).toBe('function');
    expect(typeof core.fragmentSchema.safeParse).toBe('function');
  });

  it('exports the PB-011 migration primitives', () => {
    expect(typeof core.runMigrationChain).toBe('function');
    expect(typeof core.migrateDocument).toBe('function');
    expect(core.CURRENT_SCHEMA_VERSION).toBe(1);
    expect(core.documentMigrations).toEqual([]);
  });

  it('exports the PB-012 DataType and p.* props DSL primitives', () => {
    expect(typeof core.dataTypeSchema.safeParse).toBe('function');
    expect(typeof core.dataFieldSchema.safeParse).toBe('function');
    expect(typeof core.p.text).toBe('function');
    expect(typeof core.p.select).toBe('function');
    expect(typeof core.p.list).toBe('function');
    expect(typeof core.p.object).toBe('function');
    expect(typeof core.validatePropValue).toBe('function');
  });

  it('exports the PB-013 Value<T> primitives', () => {
    expect(typeof core.valueSchema).toBe('function');
    expect(typeof core.formatSpecSchema.safeParse).toBe('function');
    expect(typeof core.s).toBe('function');
    expect(typeof core.bind).toBe('function');
    expect(typeof core.expr).toBe('function');
    expect(typeof core.withTranslation).toBe('function');
    expect(typeof core.isStaticValue).toBe('function');
    expect(typeof core.isBindingValue).toBe('function');
    expect(typeof core.isExpressionValue).toBe('function');
  });

  it('exports the PB-014 registry metadata primitives', () => {
    expect(typeof core.validateComponentMeta).toBe('function');
    expect(typeof core.isCategoryMatcher).toBe('function');
    expect(typeof core.categoryOf).toBe('function');
    expect(typeof core.isValidContentCategory).toBe('function');
    expect(typeof core.matchesType).toBe('function');
    expect(core.CONTENT_CATEGORIES).toContain('heading');
  });

  it('exports the PB-015 registry and manifest primitives', () => {
    expect(typeof core.createRegistryMeta).toBe('function');
    expect(typeof core.toManifest).toBe('function');
    expect(typeof core.fromManifest).toBe('function');
    expect(typeof core.manifestHash).toBe('function');
    expect(typeof core.registryManifestSchema.safeParse).toBe('function');
  });
});
