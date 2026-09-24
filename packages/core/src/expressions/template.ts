import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { MAX_EXPRESSION_LENGTH, type TemplateAst, type TemplatePart } from './ast.ts';
import { ExpressionSyntaxError, tokenize } from './lexer.ts';
import { parseTokens, toDiagnostic } from './parser.ts';

/**
 * Parses template source (`Hello {{ user.name }}!`) into literal text and interpolated
 * expressions (docs/expressions.md#grammar). Never throws: a syntax error inside an interpolation,
 * an unterminated `{{`, or a breached limit is a position-tagged `Diagnostic`. Offsets in the
 * resulting spans are relative to the whole template source.
 *
 * Escaping: `\{{` is the literal text `{{`. More generally a run of `n` backslashes directly before
 * `{{` stands for `floor(n / 2)` literal backslashes, and the `{{` is literal text when `n` is odd
 * (an interpolation opener otherwise); backslashes anywhere else are plain text. A stray `}}` in
 * text is plain text too. A `{` immediately before an interpolation cannot be written (`{{{`
 * opens at its first two braces, and the lone `{` is then a syntax error); use `{{ "{" }}`.
 */
export function parseTemplate(source: string): Result<TemplateAst, Diagnostic> {
  try {
    if (source.length > MAX_EXPRESSION_LENGTH) {
      throw new ExpressionSyntaxError(
        'expr.limit',
        `Template is longer than ${MAX_EXPRESSION_LENGTH} characters.`,
        [MAX_EXPRESSION_LENGTH, source.length],
        MAX_EXPRESSION_LENGTH,
      );
    }
    return ok(scan(source));
  } catch (error) {
    if (error instanceof ExpressionSyntaxError) return err(toDiagnostic(error));
    throw error;
  }
}

function scan(source: string): TemplateAst {
  const parts: TemplatePart[] = [];
  let text = '';
  let textStart = 0;
  let i = 0;

  const flushText = (end: number): void => {
    if (text.length > 0) parts.push({ kind: 'Text', value: text, span: [textStart, end] });
    text = '';
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\\') {
      let end = i;
      while (source[end] === '\\') end += 1;
      const run = end - i;
      if (!source.startsWith('{{', end)) {
        text += source.slice(i, end);
        i = end;
        continue;
      }
      text += '\\'.repeat(Math.floor(run / 2));
      if (run % 2 === 1) {
        text += '{{';
        i = end + 2;
        continue;
      }
      i = end;
    } else if (!source.startsWith('{{', i)) {
      text += ch;
      i += 1;
      continue;
    }

    // `i` is at an interpolation opener.
    const open = i;
    flushText(open);
    const tokens = tokenize(source, open + 2, true);
    const last = tokens[tokens.length - 1];
    if (last === undefined || last.type !== 'close') {
      throw new ExpressionSyntaxError('expr.syntax', 'Unterminated "{{": missing "}}".', [
        open,
        open + 2,
      ]);
    }
    if (tokens.length === 1) {
      throw new ExpressionSyntaxError('expr.syntax', 'Empty "{{ }}": expected an expression.', [
        open,
        last.span[1],
      ]);
    }
    const expr = parseTokens(tokens);
    parts.push({ kind: 'Interpolation', expr, span: [open, last.span[1]] });
    i = last.span[1];
    textStart = i;
  }

  flushText(source.length);
  return { kind: 'Template', parts, span: [0, source.length] };
}
