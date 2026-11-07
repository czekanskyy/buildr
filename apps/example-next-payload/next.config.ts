import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

// biome-ignore lint/complexity/useLiteralKeys: Environment index signature requires bracket access.
const mapFrameHost = process.env['GOOGLE_MAPS_EMBED_API_KEY']?.trim()
  ? 'https://www.google.com'
  : '';
// biome-ignore lint/complexity/useLiteralKeys: Environment index signature requires bracket access.
const captchaFrameHost = /^[A-Za-z0-9_-]{1,128}$/.test(process.env['TURNSTILE_SITE_KEY'] ?? '')
  ? 'https://challenges.cloudflare.com'
  : '';
const frameHosts = [mapFrameHost, captchaFrameHost].filter(Boolean);
const frameSrc = frameHosts.length ? `; frame-src ${frameHosts.join(' ')}` : '';

const noStore = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'X-Robots-Tag', value: 'noindex' },
];

const nextConfig: NextConfig = {
  // The rules `buildrSecurityHeaders()` (@next-buildr/next/canvas) returns. They are written out here
  // because `next.config.ts` is loaded by Node itself, which does not compile the TypeScript
  // sources of a workspace package; an application using the published package imports the function.
  headers: async () => [
    {
      source: '/buildr/canvas',
      headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }, ...noStore],
    },
    {
      source: '/buildr/edit/:path*',
      headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }, ...noStore],
    },
    {
      source: '/((?!buildr/canvas|buildr/edit).*)',
      headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self'${frameSrc}` }],
    },
  ],
  // The workspace packages ship TypeScript sources.
  transpilePackages: [
    '@next-buildr/components',
    '@next-buildr/core',
    '@next-buildr/editor',
    '@next-buildr/next',
    '@next-buildr/payload',
    '@next-buildr/react',
  ],
  images: {
    // Uploads are served by Payload from this same origin.
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
