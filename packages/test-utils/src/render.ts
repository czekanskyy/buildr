import type { DataSource } from '@next-buildr/core';
import { defaultTheme, type Theme } from '@next-buildr/core';
import { type RenderDocumentResult, renderDocument } from '@next-buildr/react/server';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoPlatform, demoRegistry } from './demo/components.ts';
import { createGalleryContext, createGalleryDataSource } from './demo/gallery.ts';

export interface RenderFixtureOptions {
  readonly theme?: Theme;
  readonly dataSource?: DataSource;
}

export interface RenderedFixture {
  /** Stylesheets and page, as static markup. Empty when the document could not be rendered. */
  readonly html: string;
  readonly diagnostics: RenderDocumentResult['diagnostics'];
}

/**
 * Renders a document with the demo components to static HTML, through the production pipeline
 * (`renderDocument`). For snapshot tests: the same input always gives the same markup.
 */
export async function renderFixtureToHtml(
  document: unknown,
  options: RenderFixtureOptions = {},
): Promise<RenderedFixture> {
  const result = await renderDocument(document, {
    registry: demoRegistry,
    theme: options.theme ?? defaultTheme,
    dataSource: options.dataSource ?? createGalleryDataSource(),
    context: createGalleryContext(),
    platform: demoPlatform,
  });
  const html = renderToStaticMarkup(createElement(Fragment, null, result.element));
  return { html, diagnostics: result.diagnostics };
}
