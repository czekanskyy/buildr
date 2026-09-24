import type { ComponentFixture } from '../fixtures.ts';
import { marketingTemplates } from './index.ts';

/**
 * One gallery fixture per template and variant, so each is reviewed at the three widths of
 * `FIXTURE_WIDTHS` next to the components it is made from.
 */
export const marketingTemplateFixtures: readonly ComponentFixture[] = marketingTemplates.flatMap(
  (template) => [
    {
      id: `template-${template.id.replace('buildr/', '')}`,
      title: template.label,
      tree: template.tree,
    },
    ...Object.entries(template.variants ?? {}).map(([variant, tree]) => ({
      id: `template-${template.id.replace('buildr/', '')}-${variant}`,
      title: `${template.label}: ${variant}`,
      tree,
    })),
  ],
);
