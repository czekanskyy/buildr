import { type ExprSpan, MAX_EXPRESSION_TOKENS } from './ast.ts';

/** A syntax or limit violation found while lexing/parsing; carries the offending source range. */
export class ExpressionSyntaxError extends Error {
  readonly code: 'expr.syntax' | 'expr.limit';
  readonly span: ExprSpan;
  readonly limit?: number;

  constructor(code: 'expr.syntax' | 'expr.limit', message: string, span: ExprSpan, limit?: number) {
    super(message);
    this.code = code;
    this.span = span;
    if (limit !== undefined) this.limit = limit;
  }
}

export type ExprTokenType = 'number' | 'string' | 'ident' | 'punct' | 'close' | 'end';

export interface ExprToken {
  readonly type: ExprTokenType;
  /** Raw source text of the token. */
  readonly text: string;
  /** Decoded value: the number for `number`, the unescaped contents for `string`. */
  readonly value?: string | number;
  readonly span: ExprSpan;
}

const PUNCT_TWO = new Set(['??', '||', '&&', '==', '!=', '<=', '>=']);
const PUNCT_ONE = new Set([
  '?',
  ':',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '(',
  ')',
  '[',
  ']',
  ',',
  '.',
]);

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\',
  "'": "'",
  '"': '"',
  n: '\n',
  r: '\r',
  t: '\t',
};

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string | undefined): boolean {
  return ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_');
}

function isIdentPart(ch: string | undefined): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function describe(ch: string): string {
  return ch.charCodeAt(0) < 0x20
    ? `U+${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
    : `"${ch}"`;
}

/**
 * Splits `source` (from offset `start`) into tokens; the last token is always `end`, or `close`
 * (the `}}` of a template interpolation) when `stopAtClose` is set and one is found outside a
 * string. Spans are absolute offsets into `source`. Throws `ExpressionSyntaxError` on an invalid
 * character, a malformed number/string, or more than `MAX_EXPRESSION_TOKENS` tokens.
 */
export function tokenize(source: string, start = 0, stopAtClose = false): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = start;

  const push = (token: ExprToken): void => {
    if (tokens.length >= MAX_EXPRESSION_TOKENS) {
      throw new ExpressionSyntaxError(
        'expr.limit',
        `Expression has more than ${MAX_EXPRESSION_TOKENS} tokens.`,
        token.span,
        MAX_EXPRESSION_TOKENS,
      );
    }
    tokens.push(token);
  };

  while (i < source.length) {
    const ch = source[i] as string;

    if (isSpace(ch)) {
      i += 1;
      continue;
    }

    if (stopAtClose && ch === '}' && source[i + 1] === '}') {
      tokens.push({ type: 'close', text: '}}', span: [i, i + 2] });
      return tokens;
    }

    if (isDigit(ch)) {
      let end = i;
      while (isDigit(source[end])) end += 1;
      if (source[end] === '.' && isDigit(source[end + 1])) {
        end += 1;
        while (isDigit(source[end])) end += 1;
      }
      if (source[end] === 'e' || source[end] === 'E') {
        let exp = end + 1;
        if (source[exp] === '+' || source[exp] === '-') exp += 1;
        if (isDigit(source[exp])) {
          while (isDigit(source[exp])) exp += 1;
          end = exp;
        }
      }
      const text = source.slice(i, end);
      const value = Number(text);
      if (!Number.isFinite(value)) {
        throw new ExpressionSyntaxError('expr.syntax', `Number "${text}" is too large.`, [i, end]);
      }
      push({ type: 'number', text, value, span: [i, end] });
      i = end;
      continue;
    }

    if (isIdentStart(ch)) {
      let end = i + 1;
      while (isIdentPart(source[end])) end += 1;
      push({ type: 'ident', text: source.slice(i, end), span: [i, end] });
      i = end;
      continue;
    }

    if (ch === '"' || ch === "'") {
      let value = '';
      let end = i + 1;
      for (;;) {
        const c = source[end];
        if (c === undefined) {
          throw new ExpressionSyntaxError('expr.syntax', 'Unterminated string.', [
            i,
            source.length,
          ]);
        }
        if (c === ch) break;
        if (c !== '\\') {
          value += c;
          end += 1;
          continue;
        }
        const esc = source[end + 1];
        if (esc === undefined) {
          throw new ExpressionSyntaxError('expr.syntax', 'Unterminated string.', [
            i,
            source.length,
          ]);
        }
        const simple = SIMPLE_ESCAPES[esc];
        if (simple !== undefined) {
          value += simple;
          end += 2;
        } else if (esc === 'u') {
          const hex = source.slice(end + 2, end + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new ExpressionSyntaxError(
              'expr.syntax',
              'Invalid "\\u" escape: expected 4 hex digits.',
              [end, Math.min(end + 6, source.length)],
            );
          }
          value += String.fromCharCode(Number.parseInt(hex, 16));
          end += 6;
        } else {
          throw new ExpressionSyntaxError('expr.syntax', `Unknown escape "\\${esc}".`, [
            end,
            end + 2,
          ]);
        }
      }
      push({ type: 'string', text: source.slice(i, end + 1), value, span: [i, end + 1] });
      i = end + 1;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (PUNCT_TWO.has(two)) {
      push({ type: 'punct', text: two, span: [i, i + 2] });
      i += 2;
      continue;
    }
    if (PUNCT_ONE.has(ch)) {
      push({ type: 'punct', text: ch, span: [i, i + 1] });
      i += 1;
      continue;
    }

    throw new ExpressionSyntaxError('expr.syntax', `Unexpected character ${describe(ch)}.`, [
      i,
      i + 1,
    ]);
  }

  tokens.push({ type: 'end', text: '', span: [source.length, source.length] });
  return tokens;
}
