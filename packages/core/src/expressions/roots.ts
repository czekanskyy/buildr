import type { ExprNode, TemplateAst } from './ast.ts';

/**
 * The root data names an expression (or template) reads — `post` for `post.title`, `item` for
 * `item.price * 2`. Used to spot dependencies on a Loop's `item`/`index`/`loop` scopes without
 * evaluating anything. A path off a computed base contributes the roots of that base.
 */
export function collectPathRoots(node: ExprNode | TemplateAst): ReadonlySet<string> {
  const roots = new Set<string>();
  visit(node, roots);
  return roots;
}

function visit(node: ExprNode | TemplateAst, out: Set<string>): void {
  switch (node.kind) {
    case 'Literal':
      return;
    case 'Path': {
      if (node.object === undefined) {
        const root = node.steps[0];
        if (typeof root === 'string') out.add(root);
      } else {
        visit(node.object, out);
      }
      return;
    }
    case 'Array':
      for (const item of node.items) visit(item, out);
      return;
    case 'Unary':
      visit(node.operand, out);
      return;
    case 'Binary':
    case 'Logical':
      visit(node.left, out);
      visit(node.right, out);
      return;
    case 'Conditional':
      visit(node.test, out);
      visit(node.consequent, out);
      visit(node.alternate, out);
      return;
    case 'Call':
      for (const arg of node.args) visit(arg, out);
      return;
    case 'Template':
      for (const part of node.parts) if (part.kind === 'Interpolation') visit(part.expr, out);
      return;
  }
}
