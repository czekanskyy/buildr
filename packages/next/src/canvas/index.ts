// @next-buildr/next/canvas: the server wrapper of the canvas route that hosts the real renderer for the
// editor's postMessage protocol, and the security headers for next.config.

export { buildrSecurityHeaders, type HeaderRule, type SecurityHeadersOptions } from './headers.ts';
export { BuildrCanvasPage, type BuildrCanvasPageProps, canvasMetadata } from './page.tsx';
