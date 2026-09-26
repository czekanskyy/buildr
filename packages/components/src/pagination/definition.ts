import { defineComponent } from '@next-buildr/react';
import { paginationProps } from './props.ts';
import { PaginationView } from './view.tsx';

/**
 * Page links for a listing. Every page is a real link (`hrefPattern` with `{page}`), so it works
 * without JavaScript and is crawlable. Inside a Loop's `after` slot, bind `page` and `totalPages`
 * to `loop.page` and `loop.totalPages`.
 */
export const Pagination = defineComponent({
  type: 'buildr/pagination',
  version: 1,
  label: 'Pagination',
  description: 'Links to the pages of a listing.',
  keywords: ['pages', 'next', 'previous', 'paging'],
  category: 'cms',
  icon: 'ellipsis',
  contentCategories: ['flow', 'landmark'],
  props: paginationProps,
  styles: {
    groups: ['layout', 'spacing', 'typography', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'nav', landmark: true },
  runtime: 'shared',
  render: PaginationView,
});
