import type { TemplateDefinition } from '@buildr/core';
import { type ComponentDefinition, createRegistry, type ReactRegistry } from '@buildr/react';
import { Accordion } from './accordion/definition.ts';
import { AccordionItem } from './accordion-item/definition.ts';
import { Badge } from './badge/definition.ts';
import { Button } from './button/definition.ts';
import { Card } from './card/definition.ts';
import { Checkbox } from './checkbox/definition.ts';
import { Container } from './container/definition.ts';
import { Divider } from './divider/definition.ts';
import { Form } from './form/definition.ts';
import { Grid } from './grid/definition.ts';
import { Heading } from './heading/definition.ts';
import { IconComponent } from './icon/definition.ts';
import { Image } from './image/definition.ts';
import { Input } from './input/definition.ts';
import { Link } from './link/definition.ts';
import { List } from './list/definition.ts';
import { ListItem } from './list-item/definition.ts';
import { Loop } from './loop/definition.ts';
import { Page } from './page/definition.ts';
import { Pagination } from './pagination/definition.ts';
import { RichText } from './rich-text/definition.ts';
import { Section } from './section/definition.ts';
import { Select } from './select/definition.ts';
import { Stack } from './stack/definition.ts';
import { contentTemplates, marketingTemplates } from './templates/index.ts';
import { Text } from './text/definition.ts';
import { Textarea } from './textarea/definition.ts';

/** Every component of the library, layout first, in the order the inserter lists them. */
export const defaultComponents: readonly ComponentDefinition[] = [
  Page,
  Section,
  Container,
  Stack,
  Grid,
  Heading,
  Text,
  RichText,
  Button,
  Link,
  Image,
  IconComponent,
  List,
  ListItem,
  Divider,
  Badge,
  Card,
  Accordion,
  AccordionItem,
  Loop,
  Pagination,
  Form,
  Input,
  Textarea,
  Select,
  Checkbox,
];

/** The marketing, blog and product templates, made only of `defaultComponents`. */
export const defaultTemplates: readonly TemplateDefinition[] = [
  ...marketingTemplates,
  ...contentTemplates,
];

/**
 * A registry of the whole library: what an application passes to the renderer, the editor and the
 * CMS integration. Add its own components and templates with `.extend()`; nothing is registered
 * globally, so two registries never share state.
 */
export function createDefaultRegistry(): ReactRegistry {
  return createRegistry({ components: defaultComponents, templates: defaultTemplates });
}
