/**
 * The overlay's palette: a fixed set of CSS variables inside the canvas, mirroring the editor's
 * accent (docs/design/identity.md, `--bd-accent`). The canvas is a separate document, so the editor's
 * own variables do not reach it and there is no protocol to send them over; theming this from the
 * editor is a later card. The values are those of the light theme's accent (readable on both).
 */
export const OVERLAY_VARS = {
  '--buildr-accent': '#3f5ae0',
  '--buildr-accent-soft': 'rgba(63, 90, 224, 0.14)',
  '--buildr-accent-text': '#ffffff',
  '--buildr-danger': '#c62b3b',
  '--buildr-danger-soft': 'rgba(198, 43, 59, 0.12)',
  '--buildr-placeholder-text': '#5b6478',
  '--buildr-font': "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

export const OVERLAY_VAR_NAMES = Object.keys(OVERLAY_VARS) as (keyof typeof OVERLAY_VARS)[];

const declarations = Object.entries(OVERLAY_VARS)
  .map(([name, value]) => `${name}: ${value};`)
  .join(' ');

/** The stylesheet of the overlay's shadow root. */
export const OVERLAY_STYLE = `
:host { all: initial; ${declarations} }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
.box { position: fixed; box-sizing: border-box; pointer-events: none; }
.box.selected { outline: 2px solid var(--buildr-accent); outline-offset: -2px; }
.box.hover { outline: 1px solid var(--buildr-accent); outline-offset: -1px; }
.box.secondary { outline-style: dashed; }
.label { position: absolute; left: 0; top: -20px; height: 20px; max-width: 280px; padding: 0 8px; box-sizing: border-box;
  overflow: hidden; text-overflow: ellipsis; font: 600 11px/20px var(--buildr-font); letter-spacing: 0.01em;
  color: var(--buildr-accent-text); background: var(--buildr-accent); border-radius: 4px 4px 0 0; white-space: nowrap; }
.label .name { font-weight: 400; opacity: 0.85; }
.label.inside { top: 0; border-radius: 0 0 4px 0; }
.handle { position: absolute; right: 0; top: -20px; width: 20px; height: 20px; background: var(--buildr-accent);
  color: var(--buildr-accent-text); font: 700 12px/20px var(--buildr-font); text-align: center; cursor: grab;
  pointer-events: auto; touch-action: none; border-radius: 4px 4px 0 0; }
.handle.inside { top: 0; border-radius: 0 0 0 4px; }
.drop { position: fixed; box-sizing: border-box; pointer-events: none; }
.drop.line { background: var(--buildr-accent); border-radius: 1px; box-shadow: 0 0 0 1px var(--buildr-accent-soft); }
.drop.line::before, .drop.line::after { content: ''; position: absolute; width: 8px; height: 8px; border-radius: 50%;
  background: var(--buildr-accent); }
.drop.line.h::before { left: -4px; top: 50%; margin-top: -4px; }
.drop.line.h::after { right: -4px; top: 50%; margin-top: -4px; }
.drop.line.v::before { top: -4px; left: 50%; margin-left: -4px; }
.drop.line.v::after { bottom: -4px; left: 50%; margin-left: -4px; }
.drop.inside { background: var(--buildr-accent-soft); outline: 2px solid var(--buildr-accent); outline-offset: -2px; }
.drop.forbidden { background: var(--buildr-danger-soft); outline: 2px solid var(--buildr-danger); outline-offset: -2px; }
.drop .reason { position: absolute; left: 0; top: 0; max-width: 320px; padding: 2px 8px; background: var(--buildr-danger);
  color: #fff; font: 500 11px/16px var(--buildr-font); border-radius: 0 0 4px 0; }
`;

/**
 * Styles for what the runtime renders into the page itself: the empty-slot placeholder. Namespaced
 * on `data-buildr-placeholder`, so it cannot reach site elements; the variables are declared on the
 * placeholder, not on `:root`.
 */
export const PAGE_STYLE = `
[data-buildr-placeholder="empty-slot"] { ${declarations} display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-height: 56px; margin: 0; padding: 12px 16px; text-align: center;
  font: 400 13px/1.4 var(--buildr-font); color: var(--buildr-placeholder-text);
  outline: 1px dashed var(--buildr-accent); outline-offset: -1px; border-radius: 2px; background: var(--buildr-accent-soft); }
`;
