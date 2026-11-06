import { err, ok, type Result } from '../result/result.ts';

// Node-level custom CSS (ADR-026). A small, strict, in-house parser: the source is tokenised into
// rules and declarations, every part is checked against an allowlist, and the output is rebuilt
// from the checked parts, scoped to one node, so the source text itself is never emitted. Core has
// no parser dependency at runtime (css-tree is a devDependency), and a hand-rolled reader of a
// deliberately tiny subset is easier to prove safe than a general one.
//
// Allowed: style rules (selectors under the node's own scope), `@media` and `@supports` around
// them, plain declarations (and `!important`, which stays inside the `buildr.custom` layer).
// Rejected: every other at-rule (`@import`, `@font-face`, `@keyframes`, `@property`, `@layer`,
// `@charset`, `@namespace`, ...), `url()` and every other function that fetches, backslash escapes,
// `<` (so no `</style>`), `expression()`, `behavior`, `-moz-binding`, `javascript:` and friends,
// nested rules, sibling combinators and selectors that name another node's class.

export const MAX_CUSTOM_CSS_LENGTH = 8000;
export const MAX_CUSTOM_CSS_RULES = 100;
export const MAX_DECLARATIONS_PER_RULE = 50;
export const MAX_DECLARATION_VALUE_LENGTH = 500;
export const MAX_SELECTOR_LENGTH = 200;
export const MAX_CUSTOM_CSS_ERRORS = 20;

export interface CustomCssResult {
  /** The scoped rules, one per line group, without the surrounding `@layer`; `''` when nothing is valid. */
  readonly css: string;
  /** Every reason a part was dropped. Empty means the whole source was accepted. */
  readonly errors: readonly string[];
}

const FORBIDDEN_TEXT =
  /url\s*\(|image-set\s*\(|image\s*\(|src\s*\(|element\s*\(|cross-fade\s*\(|paint\s*\(|attr\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|(?:^|[^A-Za-z0-9_-])data\s*:|-moz-binding|behavior\s*:|@import|<!--|-->/i;
/** C0 controls except tab and LF (CR and FF are turned into LF before this runs), and DEL. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/;
const PROPERTY = /^(--[A-Za-z0-9_-]{1,60}|-?[a-z][a-z-]{0,59})$/;
const SELECTOR_CHARS = /^[A-Za-z0-9\s.#_\-:>*()[\]="'^$|&%,+~]+$/;
const PRELUDE_CHARS = /^[A-Za-z0-9\s:().,\-/%>=]+$/;
const BANNED_PROPERTIES: ReadonlySet<string> = new Set(['behavior', '-moz-binding']);
const GROUPING_AT_RULES: ReadonlySet<string> = new Set(['media', 'supports']);

class Reader {
  i = 0;
  readonly errors: string[] = [];
  constructor(readonly s: string) {}

  get done(): boolean {
    return this.i >= this.s.length;
  }

  fail(message: string): void {
    if (this.errors.length < MAX_CUSTOM_CSS_ERRORS) this.errors.push(message);
  }

  skipSpace(): void {
    while (!this.done && /\s/.test(this.s.charAt(this.i))) this.i++;
  }

  /**
   * Reads up to (not including) the first of `stops` outside strings, parentheses and brackets.
   * `undefined` when the source ends first or a string is not closed.
   */
  readUntil(stops: string): string | undefined {
    const start = this.i;
    // One stack for `(` and `[`, as in the CSS Syntax spec: `[(])` is an unclosed `[`, not a
    // balanced pair, and a reader with two independent counters disagrees with the browser.
    const stack: string[] = [];
    while (this.i < this.s.length) {
      const c = this.s.charAt(this.i);
      if (c === '"' || c === "'") {
        const end = this.s.indexOf(c, this.i + 1);
        const newline = this.s.indexOf('\n', this.i + 1);
        if (end === -1 || (newline !== -1 && newline < end)) return undefined;
        this.i = end + 1;
        continue;
      }
      if (c === '(' || c === '[') stack.push(CLOSERS[c] ?? '');
      else if (c === ')' || c === ']') {
        if (stack.pop() !== c) {
          this.fail('brackets are not balanced');
          return undefined;
        }
      } else if (stack.length === 0 && stops.includes(c)) return this.s.slice(start, this.i);
      this.i++;
    }
    if (stack.length > 0) this.fail('a bracket is not closed');
    return undefined;
  }

  /** Skips a `{ ... }` block (cursor on the `{`), counting nested braces and skipping strings. */
  skipBlock(): boolean {
    let depth = 0;
    while (this.i < this.s.length) {
      const c = this.s.charAt(this.i);
      if (c === '"' || c === "'") {
        const end = this.s.indexOf(c, this.i + 1);
        if (end === -1 || this.s.slice(this.i + 1, end).includes('\n')) return false;
        this.i = end + 1;
        continue;
      }
      this.i++;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return true;
      }
    }
    return false;
  }
}

/** Removes comments (outside strings). `undefined` for an unterminated comment or string. */
function stripComments(source: string): string | undefined {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source.charAt(i);
    if (c === '"' || c === "'") {
      const end = source.indexOf(c, i + 1);
      // A string ends at its quote or at a newline; one that meets a newline first is bad.
      if (end === -1 || source.slice(i + 1, end).includes('\n')) return undefined;
      out += source.slice(i, end + 1);
      i = end + 1;
    } else if (c === '/' && source.charAt(i + 1) === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return undefined;
      out += ' ';
      i = end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const CLOSERS: Readonly<Record<string, string>> = { '(': ')', '[': ']' };

/**
 * Calls `visit` for every character outside strings and brackets, with one stack for `(` and `[`.
 * `false` when a closer does not match the innermost opener, a closer has no opener, an opener is
 * never closed or a string is not closed: the text is then not a balanced fragment.
 */
function scanTopLevel(text: string, visit: (c: string, index: number) => void): boolean {
  const stack: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      if (end === -1) return false;
      i = end;
    } else if (c === '(' || c === '[') stack.push(CLOSERS[c] ?? '');
    else if (c === ')' || c === ']') {
      if (stack.pop() !== c) return false;
    } else if (stack.length === 0) visit(c, i);
  }
  return stack.length === 0;
}

/** Splits at `separator` outside strings and brackets. `undefined` when the brackets are not balanced. */
function splitTop(text: string, separator: string): string[] | undefined {
  const parts: string[] = [];
  let start = 0;
  const balanced = scanTopLevel(text, (c, i) => {
    if (c === separator) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  });
  if (!balanced) return undefined;
  parts.push(text.slice(start));
  return parts;
}

/** `+` and `~` as combinators (outside parentheses, brackets and strings), which reach past the node. */
function hasSiblingCombinator(selector: string): boolean {
  let found = false;
  scanTopLevel(selector, (c) => {
    if (c === '+' || c === '~') found = true;
  });
  return found;
}

/** Every pseudo-class or pseudo-element has an identifier after its colon(s); a bare `:` is not a selector. */
function hasStrayColon(selector: string): boolean {
  const withoutStrings = selector.replace(/"[^"]*"|'[^']*'/g, '""');
  return withoutStrings.replace(/::?[A-Za-z_-][A-Za-z0-9_-]*/g, '').includes(':');
}

function scopeSelector(scope: string, selector: string, reader: Reader): string | undefined {
  const split = splitTop(selector, ',');
  if (split === undefined) {
    reader.fail('a selector has brackets that are not balanced');
    return undefined;
  }
  const parts = split.map((part) => part.trim());
  const scoped: string[] = [];
  for (const part of parts) {
    if (part === '') {
      reader.fail('a selector is empty');
      return undefined;
    }
    if (part.length > MAX_SELECTOR_LENGTH) {
      reader.fail(`a selector is longer than ${MAX_SELECTOR_LENGTH} characters`);
      return undefined;
    }
    if (!SELECTOR_CHARS.test(part)) {
      reader.fail(`the selector "${part.slice(0, 40)}" uses a character that is not allowed`);
      return undefined;
    }
    if (hasStrayColon(part)) {
      reader.fail(`the selector "${part.slice(0, 40)}" has a ":" that is not a pseudo-class`);
      return undefined;
    }
    if (/\.b-/i.test(part) || /buildr/i.test(part)) {
      reader.fail('a selector cannot name Buildr classes');
      return undefined;
    }
    if (hasSiblingCombinator(part)) {
      reader.fail(
        'sibling combinators (+ and ~) are not allowed: a rule styles the node and what is inside it',
      );
      return undefined;
    }
    const ampersands = part.split('&').length - 1;
    if (ampersands > 1 || (ampersands === 1 && !part.startsWith('&'))) {
      reader.fail('"&" (the node itself) can only start a selector');
      return undefined;
    }
    // `&2` or `&-x` would glue onto the node's class and name another class (`.b-n12`).
    if (/^&[^\s.#:[>]/.test(part)) {
      reader.fail('"&" must be followed by a space, ">", ".", "#", ":" or "["');
      return undefined;
    }
    // Whitespace runs (outside strings) become one space, so no newline reaches the output.
    const tidy = part.replace(/"[^"]*"|'[^']*'|\s+/g, (m) => (/^\s/.test(m) ? ' ' : m));
    scoped.push(tidy.startsWith('&') ? `${scope}${tidy.slice(1)}` : `${scope} ${tidy}`);
  }
  return scoped.join(', ');
}

function readDeclarations(block: string, reader: Reader): string[] {
  const out: string[] = [];
  const split = splitTop(block, ';');
  if (split === undefined) {
    reader.fail('a block has brackets that are not balanced');
    return out;
  }
  const pieces = split.map((piece) => piece.trim()).filter((piece) => piece !== '');
  if (pieces.length > MAX_DECLARATIONS_PER_RULE) {
    reader.fail(`a rule has more than ${MAX_DECLARATIONS_PER_RULE} declarations`);
    return out;
  }
  for (const piece of pieces) {
    const colon = piece.indexOf(':');
    if (colon <= 0) {
      reader.fail(`"${piece.slice(0, 40)}" is not a declaration`);
      continue;
    }
    const name = piece.slice(0, colon).trim();
    const lower = name.startsWith('--') ? name : name.toLowerCase();
    let value = piece.slice(colon + 1).trim();
    if (!PROPERTY.test(lower) || BANNED_PROPERTIES.has(lower)) {
      reader.fail(`the property "${name.slice(0, 40)}" is not allowed`);
      continue;
    }
    let important = false;
    const bang = /\s*!\s*important\s*$/i.exec(value);
    if (bang !== null) {
      important = true;
      value = value.slice(0, bang.index).trim();
    }
    if (value === '') {
      reader.fail(`"${name}" has no value`);
      continue;
    }
    if (value.length > MAX_DECLARATION_VALUE_LENGTH) {
      reader.fail(
        `the value of "${name}" is longer than ${MAX_DECLARATION_VALUE_LENGTH} characters`,
      );
      continue;
    }
    if (/[<>@\\!{}]/.test(value.replace(/"[^"]*"|'[^']*'/g, ''))) {
      reader.fail(`the value of "${name}" uses a character that is not allowed`);
      continue;
    }
    out.push(`${lower}: ${value.replace(/\s+/g, ' ')}${important ? ' !important' : ''}`);
  }
  return out;
}

interface Budget {
  rules: number;
}

function readRules(
  reader: Reader,
  scope: string,
  depth: number,
  budget: Budget,
  closer: boolean,
): string[] {
  const out: string[] = [];
  while (true) {
    reader.skipSpace();
    if (reader.done) {
      if (closer) reader.fail('a block is not closed');
      return out;
    }
    if (reader.s.charAt(reader.i) === '}') {
      if (closer) {
        reader.i++;
        return out;
      }
      reader.fail('unexpected "}"');
      reader.i++;
      continue;
    }
    if (reader.errors.length >= MAX_CUSTOM_CSS_ERRORS) return out;

    if (reader.s.charAt(reader.i) === '@') {
      const nameMatch = /^@([A-Za-z-]+)/.exec(reader.s.slice(reader.i, reader.i + 40));
      const name = nameMatch?.[1]?.toLowerCase() ?? '';
      reader.i += nameMatch?.[0].length ?? 1;
      const prelude = reader.readUntil('{;');
      if (prelude === undefined) {
        reader.fail('the stylesheet ends inside an at-rule');
        reader.i = reader.s.length;
        return out;
      }
      const opener = reader.s.charAt(reader.i);
      if (!GROUPING_AT_RULES.has(name) || opener !== '{' || depth >= 2) {
        reader.fail(
          GROUPING_AT_RULES.has(name) && opener === '{'
            ? `@${name} cannot be nested that deep`
            : `@${name || '?'} is not allowed (only @media and @supports)`,
        );
        if (opener === '{') {
          if (!reader.skipBlock()) {
            reader.i = reader.s.length;
            return out;
          }
        } else reader.i++;
        continue;
      }
      reader.i++;
      const text = prelude.trim().replace(/\s+/g, ' ');
      const inner = readRules(reader, scope, depth + 1, budget, true);
      if (text === '' || text.length > MAX_SELECTOR_LENGTH || !PRELUDE_CHARS.test(text)) {
        reader.fail(`the condition of @${name} is not valid`);
        continue;
      }
      if (inner.length > 0)
        out.push(`@${name} ${text} {\n${inner.map((r) => `  ${r}`).join('\n')}\n}`);
      continue;
    }

    const selector = reader.readUntil('{;}');
    if (selector === undefined || reader.s.charAt(reader.i) !== '{') {
      reader.fail('a rule has no block');
      reader.i = reader.s.length;
      return out;
    }
    const open = reader.i;
    reader.i++;
    const body = reader.readUntil('{}');
    if (body === undefined) {
      reader.fail('a block is not closed');
      reader.i = reader.s.length;
      return out;
    }
    if (reader.s.charAt(reader.i) === '{') {
      reader.fail('nested rules are not allowed');
      reader.i = open;
      if (!reader.skipBlock()) reader.i = reader.s.length;
      continue;
    }
    reader.i++;
    budget.rules++;
    if (budget.rules > MAX_CUSTOM_CSS_RULES) {
      reader.fail(`more than ${MAX_CUSTOM_CSS_RULES} rules`);
      reader.i = reader.s.length;
      return out;
    }
    const scoped = scopeSelector(scope, selector, reader);
    const declarations = readDeclarations(body, reader);
    if (scoped !== undefined && declarations.length > 0) {
      out.push(`${scoped} { ${declarations.join('; ')}; }`);
    }
  }
}

/**
 * Parses and scopes `source` under `scope` (a selector such as `.b-n1`). Never throws; every part
 * that is not allowed is dropped and named in `errors`, and the remaining rules are rebuilt from the
 * checked parts. The result is a list of top-level rules, to be placed inside `@layer buildr.custom`.
 */
export function compileCustomCss(scope: string, source: unknown): CustomCssResult {
  if (typeof source !== 'string') return { css: '', errors: ['custom CSS must be text'] };
  if (source.length > MAX_CUSTOM_CSS_LENGTH) {
    return {
      css: '',
      errors: [`custom CSS is at most ${MAX_CUSTOM_CSS_LENGTH} characters`],
    };
  }
  // CSS Syntax preprocessing: CRLF, CR and FF are newlines, and a newline ends a string. Turning
  // them into LF first means this reader and the browser agree on where every string ends. Other
  // control characters have no use in a stylesheet and are refused outright.
  const normalised = source.replace(/\r\n|[\r\f]/g, '\n');
  if (CONTROL_CHARACTERS.test(normalised)) {
    return { css: '', errors: ['control characters are not allowed in custom CSS'] };
  }
  const stripped = stripComments(normalised);
  if (stripped === undefined) return { css: '', errors: ['a comment or string is not closed'] };
  if (/[<\\]/.test(stripped)) {
    return { css: '', errors: ['"<" and backslash escapes are not allowed'] };
  }
  const forbidden = FORBIDDEN_TEXT.exec(stripped);
  if (forbidden !== null) {
    return {
      css: '',
      errors: [`"${forbidden[0].trim()}" is not allowed in custom CSS (nothing may load or run)`],
    };
  }
  const reader = new Reader(stripped);
  const rules = readRules(reader, scope, 0, { rules: 0 }, false);
  return { css: rules.join('\n'), errors: reader.errors };
}

/** Write-time check: ok only when the whole source is acceptable. Returns the trimmed source to store. */
export function checkCustomCss(source: unknown): Result<string, string> {
  const result = compileCustomCss('.b-check', source);
  if (result.errors.length > 0) return err(result.errors.join('; '));
  return ok((source as string).trim());
}
