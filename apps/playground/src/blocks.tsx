import '@next-buildr/components/styles.css';
import type { Diagnostic } from '@next-buildr/core';
import { DocumentRenderer } from '@next-buildr/react/client';
import { renderDocument } from '@next-buildr/react/server';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockEntries } from './blocks-fixtures.ts';
import { createBlocksOptions } from './blocks-options.ts';
import { parseBlocksRoute } from './blocks-route.ts';

/** Insert trusted server output once; this subtree never mounts React enhancers or hydrates. */
function StaticContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current && !ref.current.hasAttribute('data-inserted')) {
      ref.current.innerHTML = html;
      ref.current.setAttribute('data-inserted', '');
    }
  }, [html]);
  return <div ref={ref} />;
}

function Frame({
  entry,
  width,
  staticMarkup,
  route,
}: {
  entry: (typeof blockEntries)[number];
  width: number | undefined;
  staticMarkup: boolean;
  route: ReturnType<typeof parseBlocksRoute>;
}) {
  const options = useMemo(() => createBlocksOptions(route), [route]);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [html, setHtml] = useState<string>();
  useEffect(() => {
    if (!staticMarkup) return;
    let active = true;
    void renderDocument(entry.document, options).then((result) => {
      if (!active) return;
      setDiagnostics(result.diagnostics);
      setHtml(renderToStaticMarkup(result.element));
    });
    return () => {
      active = false;
    };
  }, [entry, staticMarkup, options]);
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
        {staticMarkup ? (
          html === undefined ? (
            <p>Loading…</p>
          ) : (
            <StaticContent html={html} />
          )
        ) : (
          <DocumentRenderer {...options} document={entry.document} onDiagnostics={setDiagnostics} />
        )}
      </div>
      <p data-testid="diagnostics">
        {diagnostics.length === 0
          ? 'No diagnostics.'
          : diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n')}
      </p>
    </>
  );
}

/** Real library fixtures, including a faithful unhydrated server-markup mode. */
export function Blocks({ search }: { search: string }) {
  const route = useMemo(() => parseBlocksRoute(search), [search]);
  const entry = blockEntries.find((candidate) => candidate.id === route.entry);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Buildr blocks</h1>
      <nav aria-label="Fixtures">
        <details>
          <summary>Entries</summary>
          <ul>
            {blockEntries.map((item) => (
              <li key={item.id}>
                <a href={`/blocks?entry=${encodeURIComponent(item.id)}`}>{item.title}</a>
              </li>
            ))}
          </ul>
        </details>
      </nav>
      {entry ? (
        <Frame
          key={`${entry.id}-${route.staticMarkup}`}
          entry={entry}
          width={route.width}
          staticMarkup={route.staticMarkup}
          route={route}
        />
      ) : route.entry ? (
        <p role="alert">Unknown entry “{route.entry}”.</p>
      ) : null}
    </main>
  );
}
