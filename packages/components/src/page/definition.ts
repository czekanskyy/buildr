import { defineComponent } from '@next-buildr/react';
import { PageView } from './view.tsx';

/** The document root: exactly one per document, never inserted, moved or removed by an editor. */
export const Page = defineComponent({
  type: 'buildr/page',
  version: 1,
  label: 'Page',
  description: 'The root of a document. Everything else lives inside it.',
  category: 'layout',
  icon: 'file',
  contentCategories: ['flow'],
  props: {},
  slots: { default: { label: 'Content', axis: 'vertical' } },
  capabilities: {
    root: true,
    insertable: false,
    draggable: false,
    removable: false,
    duplicable: false,
  },
  styles: { groups: ['spacing', 'typography', 'background'] },
  a11y: { element: 'div' },
  editor: { emptySlotText: { default: 'Add a section to start the page' } },
  runtime: 'shared',
  render: PageView,
});
