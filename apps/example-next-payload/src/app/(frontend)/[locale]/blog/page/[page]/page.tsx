import { BuildrPage } from '@next-buildr/next';
import { notFound } from 'next/navigation';
import { buildr } from '../../../../../../buildr.server.ts';
import { load, metadataFor } from '../../../../../../lib/site.ts';

interface Props {
  params: Promise<{ locale: string; page: string }>;
}

const pageOf = (value: string): number | null => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : null;
};

// The listing is the "blog" page (a Loop plus Pagination); this route only sets `route.params.page`.
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return metadataFor({ collection: 'pages', slug: 'blog', locale });
}

export default async function BlogListingPage({ params }: Props) {
  const { locale, page: raw } = await params;
  const page = pageOf(raw);
  if (page === null) notFound();
  const loaded = await load({ collection: 'pages', slug: 'blog', locale, page });
  if (loaded === null) notFound();
  return <BuildrPage config={buildr} entry={loaded.entry} />;
}
