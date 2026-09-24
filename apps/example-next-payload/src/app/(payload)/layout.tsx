import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import type { ServerFunctionClient } from 'payload';
import type { ReactNode } from 'react';
import { importMap } from './admin/importMap.js';
import './custom.scss';

export default function Layout({ children }: { children: ReactNode }) {
  const serverFunction: ServerFunctionClient = async (args) => {
    'use server';
    return handleServerFunctions({ ...args, config, importMap });
  };
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
