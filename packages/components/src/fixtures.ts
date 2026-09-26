import type { TreeNode } from '@next-buildr/core';

/**
 * One gallery/test case of a component: a subtree that is placed under the page. Breakpoint
 * behaviour is part of the fixture (`styles.bp.tablet`, …), so the gallery shows each fixture at
 * the widths in `FIXTURE_WIDTHS`.
 */
export interface ComponentFixture {
  readonly id: string;
  readonly title: string;
  readonly tree: TreeNode;
}

/** Desktop, tablet and mobile: the widths (px) every fixture is reviewed at. */
export const FIXTURE_WIDTHS = [1280, 768, 375] as const;
