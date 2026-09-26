---
'@next-buildr/mcp': minor
---

Add the agent guide, prompts and a generated tool reference (PB-144): the markdown resource `buildr://guide` (page structure, templates vs trees, tokens and breakpoints, bindings, localization, accessibility, validate-then-save, what never to do), the prompts `build-page`, `add-section`, `translate-page` and `fix-issues` (`createPrompts`, served by `createBuildrMcpServerWithTools`) on a new SDK-free `options.prompts` seam (`McpPrompt`) that enables the `prompts` capability, and `renderToolReference`. The `styles` help of tree input now names the theme's `mobile` breakpoint.
