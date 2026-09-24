import { BuildrPage, generateLocaleStaticParams } from '@buildr/next';
import { notFound } from 'next/navigation';
import { LOCALES } from '../../../../buildr.registry.ts';
import { buildr } from '../../../../buildr.server.ts';
import { isSupported, load, metadataFor, publishedSlugs } from '../../../../lib/site.ts';

interface Props {
  params: Promise<{ locale: string; slug?: string[] }>;
}

const slugOf = (slug: string[] | undefined) => slug?.join('/') ?? 'home';

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return metadataFor({ collection: 'pages', slug: slugOf(slug), locale });
}

export async function generateStaticParams() {
  return generateLocaleStaticParams({
    locales: LOCALES,
    slugs: (locale) => publishedSlugs('pages', locale),
  });
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  if (!isSupported(locale)) notFound();
  const loaded = await load({ collection: 'pages', slug: slugOf(slug), locale });
  if (loaded === null) notFound();
  return <BuildrPage config={buildr} entry={loaded.entry} />;
}
