import type { PageNode, PropDef, Value } from '@buildr/core';

/** What the inspector shows for one prop of one node. */
export interface PropReading {
  /** `static` is editable here; a binding or a formula is shown as a chip (PB-081 edits them). */
  readonly mode: 'static' | 'binding' | 'expression';
  /** The value to show: the node's own, else the default. */
  readonly value: unknown;
  /** The node carries a value for this prop (in this language), so there is something to reset. */
  readonly isSet: boolean;
  /** For a binding the path, for a formula its source. */
  readonly source: string | undefined;
}

/**
 * Reads `prop` off `node`. In a language other than the default a localizable prop shows that
 * language's translation, falling back to the default-language value (the fallback the renderer uses).
 */
export function readProp(
  node: PageNode,
  prop: string,
  def: PropDef,
  locale: string | undefined,
  defaultLocale: string | undefined,
): PropReading {
  const raw =
    node.props !== undefined && Object.hasOwn(node.props, prop) ? node.props[prop] : undefined;
  if (raw === undefined)
    return { mode: 'static', value: def.default, isSet: false, source: undefined };
  const value: Value = raw;
  if (value.kind === 'binding') {
    return { mode: 'binding', value: def.default, isSet: true, source: value.path };
  }
  if (value.kind === 'expression') {
    return { mode: 'expression', value: def.default, isSet: true, source: value.expr };
  }
  const translated = translationLocale(def, locale, defaultLocale);
  if (translated !== undefined) {
    const l10n = value.l10n;
    const has = l10n !== undefined && Object.hasOwn(l10n, translated);
    return {
      mode: 'static',
      value: has ? l10n[translated] : value.value,
      isSet: has,
      source: undefined,
    };
  }
  return { mode: 'static', value: value.value, isSet: true, source: undefined };
}

/** The language edits are written to, or `undefined` for the default language (and for props that are not translated). */
export function translationLocale(
  def: PropDef,
  locale: string | undefined,
  defaultLocale: string | undefined,
): string | undefined {
  return def.localizable && locale !== undefined && locale !== defaultLocale ? locale : undefined;
}
