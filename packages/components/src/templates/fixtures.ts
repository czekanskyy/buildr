import type { TemplateDefinition } from '@next-buildr/core';
import type { ComponentFixture } from '../fixtures.ts';
import { contentTemplates, marketingTemplates } from './index.ts';

const idOf = (templateId: string) => `template-${templateId.replace('buildr/', '')}`;

/** One fixture per template and variant of `templates`. */
function fixturesOf(templates: readonly TemplateDefinition[]): readonly ComponentFixture[] {
  return templates.flatMap((template) => [
    { id: idOf(template.id), title: template.label, tree: template.tree },
    ...Object.entries(template.variants ?? {}).map(([variant, tree]) => ({
      id: `${idOf(template.id)}-${variant}`,
      title: `${template.label}: ${variant}`,
      tree,
    })),
  ]);
}

/**
 * One gallery fixture per marketing template and variant, so each is reviewed at the three widths
 * of `FIXTURE_WIDTHS` next to the components it is made from.
 */
export const marketingTemplateFixtures: readonly ComponentFixture[] =
  fixturesOf(marketingTemplates);

/** The same for the blog and product templates; they need `templateSampleScopes` to show anything. */
export const contentTemplateFixtures: readonly ComponentFixture[] = fixturesOf(contentTemplates);
