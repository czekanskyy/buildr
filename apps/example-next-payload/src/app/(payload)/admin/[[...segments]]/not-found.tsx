import config from '@payload-config';
import { NotFoundPage } from '@payloadcms/next/views';
import type { Metadata } from 'next';
import { importMap } from '../importMap.js';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  import('@payloadcms/next/views').then(({ generatePageMetadata }) =>
    generatePageMetadata({ config, params, searchParams }),
  );

export default function NotFound({ params, searchParams }: Args) {
  return NotFoundPage({ config, params, searchParams, importMap });
}
