import type { PageNode } from '../../document/types.ts';
import type { A11yIssue, A11yRule } from '../types.ts';
import { accessibleName, isBlank, issue, setPropFix } from './helpers.ts';

export const imageAlt: A11yRule = {
  id: 'image-alt',
  severity: 'error',
  appliesTo: ['buildr/image'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      const decorative = ctx.flag(node, 'decorative');
      if (decorative.known ? decorative.value : ctx.meta(node)?.props['decorative'] !== undefined)
        continue;
      // Only an alt someone wrote as empty is judged: an unset one falls back to the media
      // asset's own alt, which the document cannot see.
      const explicit = node.props !== undefined && Object.hasOwn(node.props, 'alt');
      if (!explicit) continue;
      const alt = ctx.text(node, 'alt');
      if (alt.known && isBlank(alt.value)) {
        out.push(
          issue(this, ctx, node, 'This image has no alternative text.', {
            help: 'Describe the image, or mark it as decorative if it adds no information.',
          }),
        );
      }
    }
    return out;
  },
};

export const headingOrder: A11yRule = {
  id: 'heading-order',
  severity: 'warning',
  appliesTo: ['buildr/heading'],
  check(ctx) {
    const out: A11yIssue[] = [];
    const layoutRendersH1 = ctx.config.expectH1 === 'layout';
    // The page layout's own H1 counts as the level before the document's first heading.
    let previous: number | undefined = layoutRendersH1 ? 1 : 0;
    const h1s: PageNode[] = [];

    for (const node of ctx.nodesFor(this)) {
      const level = ctx.number(node, 'level');
      if (!level.known) {
        previous = undefined; // cannot tell what came before the next heading
        continue;
      }
      if (level.value === 1) h1s.push(node);
      if (previous !== undefined && level.value > previous + 1) {
        out.push(
          issue(this, ctx, node, `Heading level jumps from ${previous} to ${level.value}.`, {
            help: 'Do not skip levels; the size of a heading is a style, not its level.',
            fix: setPropFix(node.id, 'level', previous + 1),
          }),
        );
      }
      previous = level.value;
    }

    if (layoutRendersH1) {
      for (const node of h1s) {
        out.push(
          issue(this, ctx, node, 'The page layout already renders the H1; use a lower level.', {
            fix: setPropFix(node.id, 'level', 2),
          }),
        );
      }
    } else if (h1s.length === 0) {
      const root = ctx.doc.nodes[ctx.doc.root];
      if (root !== undefined) {
        out.push(issue(this, ctx, root, 'The page has no H1 heading.'));
      }
    } else {
      for (const node of h1s.slice(1)) {
        out.push(issue(this, ctx, node, 'The page has more than one H1 heading.'));
      }
    }
    return out;
  },
};

export const emptyHeading: A11yRule = {
  id: 'empty-heading',
  severity: 'error',
  appliesTo: ['buildr/heading'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      if (ctx.children(node).length > 0) continue;
      const text = ctx.text(node, 'text');
      if (text.known && isBlank(text.value)) {
        out.push(issue(this, ctx, node, 'This heading is empty.'));
      }
    }
    return out;
  },
};

export const buttonName: A11yRule = {
  id: 'button-name',
  severity: 'error',
  appliesTo: ['buildr/button'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      if (accessibleName(ctx, node, ['label', 'ariaLabel']) === 'unnamed') {
        out.push(
          issue(this, ctx, node, 'This button has no accessible name.', {
            help: 'Give it a label, or an accessible name if it only shows an icon.',
          }),
        );
      }
    }
    return out;
  },
};

export const linkName: A11yRule = {
  id: 'link-name',
  severity: 'error',
  appliesTo: ['buildr/link'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      if (accessibleName(ctx, node, ['label', 'ariaLabel']) === 'unnamed') {
        out.push(
          issue(this, ctx, node, 'This link has no accessible name.', {
            help: 'Give it a label, or an accessible name if it only shows an icon.',
          }),
        );
      }
    }
    return out;
  },
};

export const linkHref: A11yRule = {
  id: 'link-href',
  severity: 'warning',
  appliesTo: ['buildr/link'],
  perLocale: true,
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      const href = ctx.text(node, 'href');
      if (href.known && (isBlank(href.value) || href.value.trim() === '#')) {
        out.push(
          issue(this, ctx, node, 'This link does not point anywhere.', {
            help: 'Set a destination, or use a button if it triggers an action.',
          }),
        );
      }
    }
    return out;
  },
};

export const newTabLink: A11yRule = {
  id: 'new-tab-link',
  severity: 'info',
  appliesTo: ['buildr/link'],
  check(ctx) {
    const out: A11yIssue[] = [];
    for (const node of ctx.nodesFor(this)) {
      const newTab = ctx.flag(node, 'newTab');
      if (newTab.known && newTab.value) {
        out.push(
          issue(this, ctx, node, 'This link opens in a new tab.', {
            help: 'A visually hidden notice and rel="noopener noreferrer" are added automatically.',
          }),
        );
      }
    }
    return out;
  },
};
