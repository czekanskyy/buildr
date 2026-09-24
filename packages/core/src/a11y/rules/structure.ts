import type { PageNode } from '../../document/types.ts';
import type { A11yContext, A11yIssue, A11yRule } from '../types.ts';
import { accessibleName, isBlank, issue } from './helpers.ts';

const isInteractive = (ctx: A11yContext, node: PageNode): boolean =>
  ctx.meta(node)?.contentCategories.includes('interactive') === true;

export const nestedInteractive: A11yRule = {
  id: 'nested-interactive',
  severity: 'error',
  appliesTo: '*',
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      if (!isInteractive(ctx, node)) continue;
      const outer = ctx.ancestors(node).find((ancestor) => isInteractive(ctx, ancestor));
      if (outer !== undefined) {
        out.push(
          issue(
            this,
            ctx,
            node,
            `An interactive element cannot be inside another one (${outer.type}).`,
            { help: 'Move it out, or remove one of them.' },
          ),
        );
      }
    }
    return out;
  },
};

export const duplicateAnchor: A11yRule = {
  id: 'duplicate-anchor',
  severity: 'error',
  appliesTo: '*',
  check(ctx) {
    const out: A11yIssue[] = [];
    const seen = new Set<string>();
    for (const node of ctx.nodesFor(this)) {
      if (node.anchor === undefined || node.anchor === '') continue;
      if (seen.has(node.anchor)) {
        out.push(issue(this, ctx, node, `The anchor "${node.anchor}" is used more than once.`));
      }
      seen.add(node.anchor);
    }
    return out;
  },
};

export const listStructure: A11yRule = {
  id: 'list-structure',
  severity: 'warning',
  appliesTo: ['buildr/list'],
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const list of ctx.nodesFor(this)) {
      for (const child of ctx.children(list)) {
        // A Loop produces the items at render time.
        if (child.type === 'buildr/list-item' || child.type === 'buildr/loop') continue;
        if (ctx.meta(child) === undefined) continue;
        out.push(issue(this, ctx, child, 'A list can only contain list items.'));
      }
    }
    return out;
  },
};

/** `main` or `nav`, from the semantic prop (`as`) when the component has one, else its metadata. */
function landmarkOf(ctx: A11yContext, node: PageNode): 'main' | 'nav' | undefined {
  const meta = ctx.meta(node);
  if (meta?.a11y?.landmark !== true) return undefined;
  const as = ctx.text(node, 'as');
  const element = as.known ? as.value : meta.a11y.element;
  if (element === 'main' || meta.a11y.role === 'main') return 'main';
  if (element === 'nav' || meta.a11y.role === 'navigation') return 'nav';
  return undefined;
}

export const landmarkUnique: A11yRule = {
  id: 'landmark-unique',
  severity: 'warning',
  appliesTo: '*',
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    const mains: PageNode[] = [];
    const unnamedNavs: PageNode[] = [];
    for (const node of ctx.nodesFor(this)) {
      const landmark = landmarkOf(ctx, node);
      if (landmark === 'main') mains.push(node);
      else if (landmark === 'nav' && accessibleName(ctx, node, ['ariaLabel']) === 'unnamed') {
        unnamedNavs.push(node);
      }
    }
    for (const node of mains.slice(1)) {
      out.push(
        issue(this, ctx, node, 'A page can have only one main landmark.', { severity: 'error' }),
      );
    }
    if (unnamedNavs.length > 1) {
      for (const node of unnamedNavs) {
        out.push(
          issue(this, ctx, node, 'There are several navigation landmarks; give each a name.', {
            help: 'Set an accessible name so assistive technology can tell them apart.',
          }),
        );
      }
    }
    return out;
  },
};

export const accordionStructure: A11yRule = {
  id: 'accordion-structure',
  severity: 'error',
  appliesTo: ['buildr/accordion-item'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      const summary = ctx.text(node, 'summary');
      if (summary.known && isBlank(summary.value)) {
        out.push(issue(this, ctx, node, 'This accordion item has no summary.'));
      }
    }
    return out;
  },
};
