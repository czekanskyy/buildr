import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

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
      headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }],
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
