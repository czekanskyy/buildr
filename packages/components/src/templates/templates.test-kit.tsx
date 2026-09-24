// Shared by the template tests: the registry the templates are made from, and a page holding one.
import {
  type BuilderDocument,
  type BuilderFragment,
  instantiateTemplate,
  type TemplateDefinition,
} from '@buildr/core';
import { doc } from '@buildr/test-utils';
import { Accordion } from '../accordion/definition.ts';
import { AccordionItem } from '../accordion-item/definition.ts';
import { Badge } from '../badge/definition.ts';
import { Button } from '../button/definition.ts';
import { Card } from '../card/definition.ts';
import { Checkbox } from '../checkbox/definition.ts';
import { Form } from '../form/definition.ts';
import { Grid } from '../grid/definition.ts';
import { Heading } from '../heading/definition.ts';
import { IconComponent } from '../icon/definition.ts';
import { Image } from '../image/definition.ts';
import { Input } from '../input/definition.ts';
import { List } from '../list/definition.ts';
import { ListItem } from '../list-item/definition.ts';
import { Loop } from '../loop/definition.ts';
import { Page } from '../page/definition.ts';
import { Pagination } from '../pagination/definition.ts';
import { RichText } from '../rich-text/definition.ts';
import { Section } from '../section/definition.ts';
import { Select } from '../select/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { Textarea } from '../textarea/definition.ts';
import { contentTemplates, marketingTemplates } from './index.ts';

export const templateRegistry = createRegistry({
  components: [
    Page,
    Section,
    Grid,
    Stack,
    Heading,
    Text,
    Button,
    Badge,
    IconComponent,
    Image,
    Card,
    List,
    ListItem,
    Accordion,
    AccordionItem,
    Form,
    Input,
    Textarea,
    Select,
    Checkbox,
    Loop,
    Pagination,
    RichText,
  ],
  templates: [...marketingTemplates, ...contentTemplates],
});

/** A page whose only content is one instance of `template` (or its `variant`). */
export function documentOf(
  template: TemplateDefinition,
  variant?: string,
): { fragment: BuilderFragment; document: BuilderDocument } {
  const fragment = instantiateTemplate(template, variant);
  const page = doc({ type: 'buildr/page' });
  const root = fragment.roots[0] as string;
  const nodes = { ...page.nodes, ...fragment.nodes };
  const pageNode = nodes[page.root];
  if (pageNode === undefined) throw new Error('no page');
  return {
    fragment,
    document: {
      ...page,
      components: { ...page.components, ...fragment.components },
      nodes: { ...nodes, [page.root]: { ...pageNode, slots: { default: [root] } } },
    },
  };
}
