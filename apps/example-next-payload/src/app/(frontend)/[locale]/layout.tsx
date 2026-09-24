import '@buildr/components/styles.css';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LOCALES } from '../../../buildr.registry.ts';
import { isSupported } from '../../../lib/site.ts';

export const dynamicParams = true;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupported(locale)) notFound();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
