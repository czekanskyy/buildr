# Performance strategy

**Budgets** (a 1000-node fixture, an average laptop): opening a document in under 1.5s (excluding network); selecting a node to inspector update in under 50ms; a prop edit reflected in the canvas in under 50ms (p95); a drag-and-drop frame under 16ms; autosave serialization under 20ms; undo under 30ms. Should scale reasonably to 5000 nodes. **Production**: 0 KB of builder JS for pages with no client components; page node CSS under 50 KB (gzip under 10 KB) for a typical page.

| Problem | Technique |
|---|---|
| Large documents | The normalized model plus Immer structural sharing — a command only copies the paths it actually changes. `DocumentIndex` is O(n), memoized on `nodes` identity. |
| React re-renders (editor) | Per-node subscriptions via selectors. The inspector subscribes only to the selected node. The layers panel subscribes only to visible nodes. Stable callbacks. No large objects passed through context. |
| Layers panel | Virtualization (`@tanstack/react-virtual`) above roughly 150 visible rows. |
| Canvas | Patches, not full documents. `NodeView` memoized on node identity (normalization means a child change never changes its parent's object identity). CSS applied incrementally, cached per node. |
| Selection/hover overlay | Only for the selected and hovered node (`ResizeObserver` on at most two elements), positioned on `requestAnimationFrame`, rendered in a Shadow DOM. |
| Drag and drop | Hit-testing once per frame, forwarding on `requestAnimationFrame`, a ghost driven by direct DOM manipulation (no React state on every `pointermove`), rects read once per frame. |
| Validation / accessibility | Debounced 300ms plus `requestIdleCallback`. A Web Worker is a v1.0 option if benchmarks show it's needed. |
| Serialization / autosave | Debounced 2s with a 20s max wait, single-flight, one-pass `JSON.stringify`. |
| Expressions | An LRU cache of compiled ASTs. |
| Production | Rendering happens in RSC, CSS is cached by content hash, data reads are tag-cached, media lookups are batched. |

Benchmarks (`vitest bench`: commands, index construction, CSS compilation, `resolveProps`, `prepareRender` at 1000/5000 nodes) run nightly with regression thresholds. Playwright traces of canvas editing interactions also run nightly.
