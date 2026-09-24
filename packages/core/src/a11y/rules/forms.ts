import type { A11yIssue, A11yRule } from '../types.ts';
import { accessibleName, issue } from './helpers.ts';

const FORM_FIELDS = [
  'buildr/input',
  'buildr/textarea',
  'buildr/select',
  'buildr/checkbox',
] as const;

export const formLabel: A11yRule = {
  id: 'form-label',
  severity: 'error',
  appliesTo: FORM_FIELDS,
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodes()) {
      const isField = (FORM_FIELDS as readonly string[]).includes(node.type);
      if (!isField && ctx.meta(node)?.formField === undefined) continue;
      if (accessibleName(ctx, node, ['label', 'ariaLabel']) === 'unnamed') {
        out.push(
          issue(this, ctx, node, 'This form field has no label.', {
            help: 'Every field needs a label; hide it visually if the design has none.',
          }),
        );
      }
    }
    return out;
  },
};

export const formSubmit: A11yRule = {
  id: 'form-submit',
  severity: 'warning',
  appliesTo: ['buildr/form'],
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const form of ctx.nodesFor(this)) {
      const submits = ctx.descendants(form).some((node) => {
        if (node.type !== 'buildr/button') return false;
        const declared = ctx.meta(node)?.props['type'] !== undefined;
        if (!declared) return true; // no `type`: HTML's default is a submit button
        const type = ctx.text(node, 'type');
        return !type.known || (type.value !== 'button' && type.value !== 'reset');
      });
      if (!submits) out.push(issue(this, ctx, form, 'This form has no submit button.'));
    }
    return out;
  },
};
