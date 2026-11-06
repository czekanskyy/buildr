import { createGalleryDataSource, defaultTheme } from '@next-buildr/components';
import '@next-buildr/components/styles.css';
import { DocumentRenderer } from '@next-buildr/react/client';
import { demoPlatform } from '@next-buildr/test-utils/demo/components';
import { useMemo } from 'react';
import { PLAYGROUND_LOCALES, sampleScopes } from './memory-adapter.ts';
import { parsePreviewRoute, readPreviewDocument } from './preview-route.ts';
import { registry } from './registry.ts';

/** Visitor output only. The editor snapshots the current saved draft when opening Preview. */
export function PreviewPage({ search }: { search: string }) {
  const dataSource = useMemo(createGalleryDataSource, []);
  const document = useMemo(() => {
    const ref = parsePreviewRoute(search);
    if (ref === undefined) return undefined;
    try {
      return readPreviewDocument(ref, window.sessionStorage);
    } catch {
      return undefined;
    }
  }, [search]);
  const context = useMemo(
    () => ({
      scopes: sampleScopes(null, PLAYGROUND_LOCALES.default),
      locale: PLAYGROUND_LOCALES.default,
      locales: { default: 'en', fallback: true, intl: { ...PLAYGROUND_LOCALES.intl } },
      timeZone: 'UTC',
      mode: 'preview' as const,
    }),
    [],
  );
  if (document === undefined)
    return <p role="alert">Preview unavailable. Open Preview from the editor again.</p>;
  return (
    <DocumentRenderer
      document={document}
      registry={registry}
      theme={defaultTheme}
      context={context}
      platform={demoPlatform}
      dataSource={dataSource}
      fallback={<p>Loading…</p>}
    />
  );
}
