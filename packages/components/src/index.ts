// Public entry point of @buildr/components: component definitions, createDefaultRegistry,
// defaultTheme, templates. Populated by docs/backlog/phase-07-components.md.

export { Accordion } from './accordion/definition.ts';
export { accordionFixtures } from './accordion/fixtures.ts';
export { AccordionItem } from './accordion-item/definition.ts';
export { accordionItemFixtures } from './accordion-item/fixtures.ts';
export { BADGE_VARIANTS, Badge } from './badge/definition.ts';
export { badgeFixtures } from './badge/fixtures.ts';
export {
  BUTTON_SIZES,
  BUTTON_TYPES,
  BUTTON_VARIANTS,
  Button,
  ICON_POSITIONS,
} from './button/definition.ts';
export { buttonFixtures } from './button/fixtures.ts';
export { CARD_ELEMENTS, CARD_VARIANTS, Card } from './card/definition.ts';
export { cardFixtures } from './card/fixtures.ts';
export { Checkbox } from './checkbox/definition.ts';
export { checkboxFixtures } from './checkbox/fixtures.ts';
export { CONTAINER_WIDTHS, Container } from './container/definition.ts';
export { containerFixtures } from './container/fixtures.ts';
export { Divider } from './divider/definition.ts';
export { dividerFixtures } from './divider/fixtures.ts';
export type { ComponentFixture } from './fixtures.ts';
export { FIXTURE_WIDTHS } from './fixtures.ts';
export { Form } from './form/definition.ts';
export { formFixtures } from './form/fixtures.ts';
export { Grid } from './grid/definition.ts';
export { gridFixtures } from './grid/fixtures.ts';
export { HEADING_LEVELS, Heading } from './heading/definition.ts';
export { headingFixtures } from './heading/fixtures.ts';
export { ICON_SIZES, IconComponent } from './icon/definition.ts';
export { iconFixtures } from './icon/fixtures.ts';
export type { IconName, IconNode, IconProps, IconShape } from './icons/index.ts';
export { hasIcon, ICON_NAMES, ICON_NODES, Icon } from './icons/index.ts';
export { IMAGE_FITS, IMAGE_SIZES, Image } from './image/definition.ts';
export { imageFixtureMedia, imageFixtures } from './image/fixtures.ts';
export { INPUT_TYPES, Input } from './input/definition.ts';
export { inputFixtures } from './input/fixtures.ts';
export { Link } from './link/definition.ts';
export { linkFixtures } from './link/fixtures.ts';
export { List } from './list/definition.ts';
export { listFixtures } from './list/fixtures.ts';
export { ListItem } from './list-item/definition.ts';
export { listItemFixtures } from './list-item/fixtures.ts';
export { Loop } from './loop/definition.ts';
export { loopFixtureCollections, loopFixtures } from './loop/fixtures.ts';
export type { MessageKey } from './messages/index.ts';
export { BUILT_IN_MESSAGES, message } from './messages/index.ts';
export { Page } from './page/definition.ts';
export { pageFixtures } from './page/fixtures.ts';
export { Pagination } from './pagination/definition.ts';
export { paginationFixtures } from './pagination/fixtures.ts';
export type { PageItem } from './pagination/pages.ts';
export { pageItems } from './pagination/pages.ts';
export { RichText } from './rich-text/definition.ts';
export { richTextFixtures } from './rich-text/fixtures.ts';
export { SECTION_CONTAINERS, SECTION_ELEMENTS, Section } from './section/definition.ts';
export { sectionFixtures } from './section/fixtures.ts';
export { Select } from './select/definition.ts';
export { selectFixtures } from './select/fixtures.ts';
export { STACK_ROLES, Stack } from './stack/definition.ts';
export { stackFixtures } from './stack/fixtures.ts';
export { marketingTemplateFixtures } from './templates/fixtures.ts';
export {
  AuthorBox,
  BlogListing,
  Contact,
  Cta,
  contentTemplates,
  Faq,
  FeatureGrid,
  Hero,
  marketingTemplates,
  PostCard,
  PostContent,
  PostHeader,
  Pricing,
  ProductDetails,
  ProductHero,
  Testimonial,
} from './templates/index.ts';
export { templateSampleCollections, templateSampleScopes } from './templates/sample-data.ts';
export { TEXT_ELEMENTS, Text } from './text/definition.ts';
export { textFixtures } from './text/fixtures.ts';
export { Textarea } from './textarea/definition.ts';
export { textareaFixtures } from './textarea/fixtures.ts';
