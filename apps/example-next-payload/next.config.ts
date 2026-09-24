import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript sources.
  transpilePackages: [
    '@buildr/components',
    '@buildr/core',
    '@buildr/editor',
    '@buildr/next',
    '@buildr/payload',
    '@buildr/react',
  ],
  images: {
    // Uploads are served by Payload from this same origin.
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
