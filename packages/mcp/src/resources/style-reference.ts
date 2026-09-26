import {
  propertiesOfGroup,
  STYLE_GROUPS,
  type StyleGrammar,
  type StyleGroup,
  type StylePropertyDef,
  type Theme,
  TOKEN_SCALES,
} from '@next-buildr/core';
import { list } from '../serialize/text.ts';

// The style reference an agent reads before styling: how styles are stored, the value grammar of
// every property (never free-form CSS), the theme's tokens and breakpoints. Derived from core's
// property registry and the site's theme, so it can never drift from what the compiler accepts.

const GRAMMAR_EXAMPLES: Readonly<Record<StyleGrammar['kind'], string>> = {
  composite: 'a token ("$space.4"), a keyword ("auto"), a length ("16px", "50%") or a number',
  color:
    'a color token ("$color.primary") or a color ("#1a1a1a", "rgb(0 0 0 / 50%)", "transparent")',
  ratio: '"16/9" or "1.5"',
  gradient: 'a linear/radial gradient made of theme colors',
  gridTrack: 'an integer 1..12 (that many equal tracks)',
  gridSpan: 'an integer 1..12',
  boolean: 'true or false',
  shadow: 'shadow tokens ("$shadow.md") or up to 4 layers "[inset] x y [blur [spread]] color"',
  fontFamily: 'a font token ("$fontFamily.body") or family names',
  transition: 'a transition token or "[property] duration [timing] [delay]"',
};

/** One line describing what `grammar` accepts. */
export function describeGrammar(grammar: StyleGrammar): string {
  if (grammar.kind === 'composite') {
    const parts: string[] = [];
    if (grammar.tokens?.length)
      parts.push(`tokens ${grammar.tokens.map((s) => `$${s}.*`).join(', ')}`);
    if (grammar.keywords?.length) parts.push(`keywords ${grammar.keywords.join(' | ')}`);
    if (grammar.length)
      parts.push(
        `length in ${grammar.length.units.join('/')}${grammar.length.negative ? ' (negative allowed)' : ''}`,
      );
    if (grammar.number)
      parts.push(
        `${grammar.number.integer ? 'integer' : 'number'} ${grammar.number.min}..${grammar.number.max}`,
      );
    return parts.join('; ') || 'composite';
  }
  if (grammar.kind === 'color') {
    const keywords = grammar.keywords?.length ? `; keywords ${grammar.keywords.join(' | ')}` : '';
    return `color (token $color.* or a color value)${keywords}`;
  }
  return GRAMMAR_EXAMPLES[grammar.kind];
}

function propertyLine(def: StylePropertyDef): string {
  const shape =
    def.shape === 'box'
      ? ' {top,right,bottom,left}'
      : def.shape === 'corners'
        ? ' {topLeft,topRight,bottomRight,bottomLeft}'
        : '';
  const flags = [
    def.inheritable ? 'accepts "inherit"' : undefined,
    def.allowInStates ? 'allowed in hover/focus-visible/active' : undefined,
  ].filter((flag) => flag !== undefined);
  return `- ${def.group}.${def.name}${shape}: ${describeGrammar(def.grammar)}${
    flags.length > 0 ? ` [${flags.join('; ')}]` : ''
  }`;
}

function isStyleGroup(value: string): value is StyleGroup {
  return (STYLE_GROUPS as readonly string[]).includes(value);
}

/** The valid group ids, for input validation and messages. */
export const STYLE_GROUP_IDS: readonly string[] = STYLE_GROUPS;

/** Renders the reference; `group` restricts the property list to one group. */
export function renderStyleReference(theme: Theme, group?: string): string {
  if (group !== undefined && !isStyleGroup(group)) {
    return `Unknown style group "${group}". Groups: ${STYLE_GROUPS.join(', ')}.`;
  }
  const lines: string[] = [];
  lines.push(
    'How styles are stored on a node:',
    '- `styles.base` is the default; `styles.bp.<breakpoint>` overrides it at and below that viewport width; `styles.state.<hover|focus-visible|active>` overrides visual properties in a pseudo-state.',
    '- Each layer holds groups, each group holds properties: { "spacing": { "padding": { "top": "$space.4" } }, "typography": { "color": "$color.primary" } }.',
    '- Values are strings or numbers written in the property grammar below. There is no free-form CSS: url(), var(), calc(), ";", braces and !important are rejected.',
    '- Prefer theme tokens ("$scale.name") over raw values so the page follows the theme.',
    '',
  );

  lines.push('Value examples:');
  lines.push(
    '- token: "$space.4", "$color.primary", "$radius.md", "$fontSize.lg"',
    '- length: "16px", "1.5rem", "100%", "60ch"; box properties take one value per side',
    '- keyword: "flex", "center", "auto"; grid columns: 3 (an integer 1..12)',
    '',
  );

  const groups = group === undefined ? STYLE_GROUPS : [group];
  lines.push(group === undefined ? 'Style properties by group:' : `Style properties of ${group}:`);
  for (const id of groups) {
    if (group === undefined) lines.push(`${id}:`);
    for (const def of propertiesOfGroup(id)) lines.push(propertyLine(def));
  }
  lines.push('');

  lines.push('Theme tokens (reference as "$scale.name"):');
  for (const scale of TOKEN_SCALES) {
    const tokens = theme.tokens[scale];
    const names = Object.keys(tokens);
    if (names.length === 0) continue;
    lines.push(
      `- ${scale}: ${list(
        names.map((name) => `${name}=${tokens[name]}`),
        40,
      )}`,
    );
  }
  lines.push('');

  lines.push('Breakpoints (desktop-first; a `bp` layer applies at and below its width):');
  lines.push(
    theme.breakpoints.length > 0
      ? theme.breakpoints.map((bp) => `- ${bp.id}: up to ${bp.maxWidth}px`).join('\n')
      : '- none defined',
  );
  lines.push(
    '',
    'Which groups a component offers is part of its description (describe_component "Style groups").',
  );
  return lines.join('\n');
}
