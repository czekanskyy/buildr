import { BuildrPage } from '@buildr/next';
import { notFound } from 'next/navigation';
import { LOCALES } from '../../../../../buildr.registry.ts';
import { buildr } from '../../../../../buildr.server.ts';
import { load, metadataFor, publishedSlugs } from '../../../../../lib/site.ts';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return metadataFor({ collection: 'products', slug, locale });
}

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of LOCALES) {
    for (const slug of await publishedSlugs('products', locale)) {
      params.push({ locale, slug });
    }
  }
  return params;
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const loaded = await load({ collection: 'products', slug, locale });
  if (loaded === null) notFound();
  return <BuildrPage config={buildr} entry={loaded.entry} />;
}
