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
:host { all: initial; ${declarations} --buildr-surface: #ffffff; --buildr-text: #1c1d22; --buildr-hover: #f0f1f5; --buildr-border: #dfe1e7; --buildr-shadow: rgba(0,0,0,.16); }
:host([data-theme="dark"]) { --buildr-accent: #8ea2f5; --buildr-accent-soft: #25325f; --buildr-accent-text: #0f1636; --buildr-danger: #ff8a8a; --buildr-danger-soft: #3d2226; --buildr-surface: #1c1d22; --buildr-text: #ecedf1; --buildr-hover: #2b2d35; --buildr-border: #33363f; --buildr-shadow: rgba(0,0,0,.55); }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
.toolbar { position: fixed; z-index: 2; display:flex; align-items:center; gap:2px; height:40px; padding:4px; box-sizing:border-box; border-radius:8px; background:var(--buildr-surface); color:var(--buildr-text); box-shadow:0 4px 12px var(--buildr-shadow), 0 0 0 1px var(--buildr-border); pointer-events:auto; font:500 11px var(--buildr-font); }
.divider { width:1px; height:20px; margin:0 4px; background:var(--buildr-border); flex:none; }
.tool { display:inline-flex; align-items:center; justify-content:center; flex:none; width:32px; height:32px; padding:0; border:0; border-radius:4px; background:transparent; color:inherit; cursor:pointer; font:inherit; }
.tool:hover { background:var(--buildr-hover); }
.tool:focus-visible { outline:2px solid var(--buildr-accent); outline-offset:-2px; }
.tool svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; }
.tool.drag { cursor:grab; touch-action:none; }
.tool.drag svg, .tool.more svg { stroke-width:3; }
.tool.remove:hover { color:var(--buildr-danger); background:var(--buildr-danger-soft); }
.align-menu { position:absolute; left:0; top:44px; display:flex; padding:4px; border-radius:8px; background:var(--buildr-surface); box-shadow:0 4px 12px var(--buildr-shadow); }
.align-menu[hidden] { display:none; }
.outline { position:fixed; box-sizing:border-box; outline:1px dashed var(--buildr-accent); outline-offset:-1px; }
.insert-gap { position:fixed; z-index:1; height:16px; display:flex; justify-content:center; align-items:center; pointer-events:none; }
.insert-gap::after { content:''; position:absolute; inset:0; pointer-events:auto; }
.insert-gap::before { content:''; position:absolute; left:16px; right:16px; top:50%; height:1px; background:var(--buildr-accent); opacity:0; }
.ins-btn { position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; padding:0; border:0; width:28px; height:28px; border-radius:50%; background:var(--buildr-accent); color:var(--buildr-accent-text); opacity:0; pointer-events:none; cursor:pointer; }
.ins-btn svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.75; }
.insert-gap:hover::before, .insert-gap:focus-within::before, .insert-gap.hot::before { opacity:1; }
.insert-gap:hover .ins-btn, .insert-gap:focus-within .ins-btn, .insert-gap.hot .ins-btn { opacity:1; pointer-events:auto; }
.ins-btn:focus-visible { outline:2px solid var(--buildr-accent); outline-offset:2px; }
.box { position: fixed; box-sizing: border-box; pointer-events: none; }
.box.selected { outline: calc(2px * var(--k, 1)) solid var(--buildr-accent); outline-offset: calc(2px * var(--k, 1)); }
.box.hover { outline: calc(1px * var(--k, 1)) solid var(--buildr-accent); outline-offset: calc(-1px * var(--k, 1)); }
.box.hover.container, .box.secondary { outline-style: dashed; }
.label { position: absolute; left: calc(-2px * var(--k, 1)); top: calc(-24px * var(--k, 1)); scale: var(--k, 1); transform-origin: 0 0; height: 20px; max-width: 280px; padding: 0 8px; box-sizing: border-box;
  overflow: hidden; text-overflow: ellipsis; font: 600 11px/20px var(--buildr-font); letter-spacing: 0.01em;
  color: var(--buildr-accent-text); background: var(--buildr-accent); border-radius: 4px 4px 0 0; white-space: nowrap; }
.label .name { font-weight: 400; opacity: 0.85; }
.label.pop { animation: bd-pop 160ms cubic-bezier(0.2, 0, 0, 1); }
.label.inside { top: 0; left: 0; border-radius: 0 0 4px 0; }
@keyframes bd-pop { from { opacity: 0; translate: 0 4px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) { .label.pop { animation: none; } }
.handle { position: absolute; right: calc(-2px * var(--k, 1)); top: calc(-24px * var(--k, 1)); scale: var(--k, 1); transform-origin: 100% 0; width: 20px; height: 20px; background: var(--buildr-accent);
  color: var(--buildr-accent-text); font: 700 12px/20px var(--buildr-font); text-align: center; cursor: grab;
  pointer-events: auto; touch-action: none; border-radius: 4px 4px 0 0; }
.handle.inside { top: 0; right: 0; border-radius: 0 0 0 4px; }
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
[data-bid][data-buildr-dimmed] { opacity: .35; filter: grayscale(1); }
[data-buildr-placeholder="empty-slot"] { ${declarations} display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-height: 56px; margin: 0; padding: 12px 16px; text-align: center;
  font: 400 13px/1.4 var(--buildr-font); color: var(--buildr-placeholder-text);
  outline: 1px dashed var(--buildr-accent); outline-offset: -1px; border-radius: 2px; background: var(--buildr-accent-soft); }
`;
