import type { ExprNode, ExprPathStep, TemplateAst } from './ast.ts';

/** Precedence of each node, matching the parser's binding powers; higher binds tighter. */
const PREC = {
  conditional: 1,
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 5,
  '!=': 5,
  '<': 6,
  '<=': 6,
  '>': 6,
  '>=': 6,
  '+': 7,
  '-': 7,
  '*': 8,
  '/': 8,
  '%': 8,
  unary: 9,
  primary: 10,
} as const;

const IDENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function precedenceOf(node: ExprNode): number {
  switch (node.kind) {
    case 'Conditional':
      return PREC.conditional;
    case 'Binary':
    case 'Logical':
      return PREC[node.op];
    case 'Unary':
      return PREC.unary;
    default:
      return PREC.primary;
  }
}

const STRING_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

function printString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const escaped = STRING_ESCAPES[ch];
    if (escaped !== undefined) out += escaped;
    else if (ch < ' ') out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

function printStep(step: ExprPathStep): string {
  if (typeof step === 'number') return `[${step}]`;
  return IDENT_PATTERN.test(step) ? `.${step}` : `[${printString(step)}]`;
}

function print(node: ExprNode, minPrec: number): string {
  const text = printBare(node);
  return precedenceOf(node) < minPrec ? `(${text})` : text;
}

function printBare(node: ExprNode): string {
  switch (node.kind) {
    case 'Literal':
      return typeof node.value === 'string' ? printString(node.value) : String(node.value);
    case 'Path': {
      if (node.object === undefined) {
        const [root, ...rest] = node.steps;
        return `${root}${rest.map(printStep).join('')}`;
      }
      return `${print(node.object, PREC.primary)}${node.steps.map(printStep).join('')}`;
    }
    case 'Array':
      return `[${node.items.map((item) => print(item, PREC.conditional)).join(', ')}]`;
    case 'Unary':
      return `${node.op}${print(node.operand, PREC.unary)}`;
    case 'Binary':
    case 'Logical': {
      // Every binary level is left-associative: the right operand needs strictly tighter binding.
      const prec = PREC[node.op];
      return `${print(node.left, prec)} ${node.op} ${print(node.right, prec + 1)}`;
    }
    case 'Conditional':
      return `${print(node.test, PREC['??'])} ? ${print(node.consequent, PREC.conditional)} : ${print(node.alternate, PREC.conditional)}`;
    case 'Call':
      return `${node.name}(${node.args.map((arg) => print(arg, PREC.conditional)).join(', ')})`;
  }
}

/**
 * Prints an AST as normalized source: canonical spacing and quoting, and only the parentheses that
 * precedence/associativity require. `parseExpression(printExpression(ast))` yields an AST equal to
 * `ast` ignoring spans (for any AST the parser could have produced).
 */
export function printExpression(node: ExprNode): string {
  return print(node, PREC.conditional);
}

/**
 * Escapes literal template text so it re-parses to the same text: a run of `n` backslashes that
 * directly precedes a `{{` (or the end of the text, when an interpolation follows) is doubled, and
 * a `{{` itself gets one more backslash.
 */
function escapeTemplateText(text: string, followedByInterpolation: boolean): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '\\') {
      if (text.startsWith('{{', i)) {
        out += '\\{{';
        i += 2;
      } else {
        out += text[i];
        i += 1;
      }
      continue;
    }
    let end = i;
    while (text[end] === '\\') end += 1;
    const run = end - i;
    const beforeOpen =
      text.startsWith('{{', end) || (end === text.length && followedByInterpolation);
    out += '\\'.repeat(beforeOpen ? run * 2 : run);
    i = end;
  }
  return out;
}

/** Prints a template AST as normalized source (`{{ expr }}` interpolations, escaped text). */
export function printTemplate(template: TemplateAst): string {
  return template.parts
    .map((part, index) => {
      if (part.kind === 'Interpolation') return `{{ ${printExpression(part.expr)} }}`;
      return escapeTemplateText(part.value, template.parts[index + 1]?.kind === 'Interpolation');
    })
    .join('');
}
