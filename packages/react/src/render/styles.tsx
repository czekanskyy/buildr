import {
  type CompiledStyles,
  compileTokens,
  hash,
  LAYER_ORDER_CSS,
  type Theme,
} from '@buildr/core';

export interface BuildrStylesProps {
  /** The result of `compileStyles(doc, theme)`. */
  readonly styles: CompiledStyles;
  /** The theme it was compiled with. */
  readonly theme: Theme;
}

/**
 * The stylesheet of one document, as React 19 `<style href precedence>` elements: React hoists
 * them into `<head>` and emits each `href` only once per page (docs/styles.md#css-strategy).
 *
 * It is split in two so that what several documents share is sent once: the layer order and the
 * theme's tokens (keyed by their own content) and the node rules (keyed by the compiled
 * stylesheet's hash). Two pages on the same theme repeat neither the layer declaration nor the
 * tokens. Contains no hooks, so it works in RSC and on the client.
 */
export function BuildrStyles({ styles, theme }: BuildrStylesProps) {
  const prelude = `${LAYER_ORDER_CSS}\n${compileTokens(theme)}`;
  // `compileStyles` puts the prelude first; if a stylesheet ever does not, send it whole.
  const split = styles.css.startsWith(prelude);
  const nodes = split ? styles.css.slice(prelude.length).trim() : styles.css;
  return (
    <>
      {split ? (
        <style href={`buildr-theme-${hash(prelude)}`} precedence="buildr">
          {prelude}
        </style>
      ) : null}
      {nodes === '' ? null : (
        <style href={`buildr-${styles.hash}`} precedence="buildr">
          {nodes}
        </style>
      )}
    </>
  );
}
