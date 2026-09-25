import { type Diagnostic, defaultTheme } from '@buildr/core';
import { DocumentRenderer } from '@buildr/react/client';
import {
  createGalleryContext,
  createGalleryDataSource,
  type GalleryFixture,
  galleryFixtures,
} from '@buildr/test-utils';
import { demoPlatform, demoRegistry } from '@buildr/test-utils/demo/components';
import { useMemo, useState } from 'react';
import { galleryHref, parseGalleryRoute } from './route.ts';

const WIDTHS = [375, 768, 1280] as const;

function Frame({ fixture, width }: { fixture: GalleryFixture; width: number | undefined }) {
  const dataSource = useMemo(createGalleryDataSource, []);
  const context = useMemo(createGalleryContext, []);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);

  return (
    <>
      <div
        data-testid="frame"
        style={{
          boxSizing: 'border-box',
          width: width ?? '100%',
          border: '1px dashed #999',
          margin: '0 auto',
          padding: 8,
        }}
      >
        <DocumentRenderer
          document={fixture.document}
          registry={demoRegistry}
          theme={defaultTheme}
          context={context}
          platform={demoPlatform}
          dataSource={dataSource}
          fallback={<p>Loading…</p>}
          onDiagnostics={setDiagnostics}
        />
      </div>
      <p data-testid="diagnostics">
        {diagnostics.length === 0
          ? 'No diagnostics.'
          : diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n')}
      </p>
    </>
  );
}

/** `/gallery` lists the fixtures; `/gallery?fixture=<id>&w=<px>` renders one at a chosen width. */
export function Gallery({ search }: { search: string }) {
  const route = parseGalleryRoute(search);
  const fixture = galleryFixtures.find((f) => f.id === route.fixture);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Buildr playground</h1>
      <nav aria-label="Fixtures">
        <ul>
          {galleryFixtures.map((f) => (
            <li key={f.id}>
              <a href={galleryHref({ fixture: f.id, width: route.width })}>{f.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      {route.fixture !== undefined && fixture === undefined ? (
        <p role="alert">Unknown fixture “{route.fixture}”.</p>
      ) : null}
      {fixture !== undefined ? (
        <>
          <nav aria-label="Width">
            {WIDTHS.map((w) => (
              <a key={w} href={galleryHref({ fixture: fixture.id, width: w })}>
                {w}px{' '}
              </a>
            ))}
            <a href={galleryHref({ fixture: fixture.id })}>full</a>
          </nav>
          <Frame key={fixture.id} fixture={fixture} width={route.width} />
        </>
      ) : null}
    </main>
  );
}
