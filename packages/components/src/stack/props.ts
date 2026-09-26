import { p } from '@next-buildr/core';

/** `none` adds no role; `group` needs an accessible name; `list` needs `buildr/list-item` children. */
export const STACK_ROLES = ['none', 'group', 'list'] as const;

export const stackProps = {
  role: p.select({ label: 'Role', options: STACK_ROLES, default: 'none' }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
