import { GUIDE_MARKDOWN } from './guide-text.ts';

// `buildr://guide` (PB-144): how to build good pages with Buildr. The source is `guide.md` (edit
// that); `guide-text.ts` is generated from it (`UPDATE_MCP_DOCS=1 pnpm test --filter @next-buildr/mcp`,
// a test fails when they differ) so the guide ships inside the compiled JS with no runtime file
// access, which works in bundlers, serverless functions and `npx` alike.

export const GUIDE_URI = 'buildr://guide';

export const GUIDE_MIME_TYPE = 'text/markdown';

/** The guide as markdown. */
export function renderGuide(): string {
  return GUIDE_MARKDOWN;
}
