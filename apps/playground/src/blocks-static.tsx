import { renderDocument } from '@next-buildr/react/server';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockEntries } from './blocks-fixtures.ts';
import { createBlocksOptions } from './blocks-options.ts';
import { parseBlocksRoute } from './blocks-route.ts';
export async function renderStaticBlocks(search: string, stylesheet: string) {
  const route = parseBlocksRoute(search);
  const entry = blockEntries.find((e) => e.id === route.entry);
  if (!entry) return undefined;
  const result = await renderDocument(entry.document, createBlocksOptions(route));
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Buildr blocks</title>
          <link rel="stylesheet" href={stylesheet} />
        </head>
        <body>
          <main>
            <h1>Buildr blocks</h1>
            <div data-testid="frame" style={{ width: route.width ?? '100%' }}>
              {result.element}
            </div>
            <p data-testid="diagnostics">
              {result.diagnostics.length === 0
                ? 'No diagnostics.'
                : result.diagnostics.map((d) => d.code).join(', ')}
            </p>
          </main>
        </body>
      </html>,
    )
  );
}
