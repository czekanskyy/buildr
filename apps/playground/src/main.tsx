import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Blocks } from './blocks.tsx';
import { CanvasPage } from './canvas.tsx';
import { EditorPage } from './editor.tsx';
import { Gallery } from './gallery.tsx';
import { PreviewPage } from './preview.tsx';

const container = document.getElementById('root');
if (container === null) throw new Error('#root is missing from index.html');

const { pathname, search } = window.location;
const page = pathname.startsWith('/canvas') ? (
  <CanvasPage />
) : pathname === '/preview' ? (
  <PreviewPage search={search} />
) : pathname.startsWith('/gallery') ? (
  <Gallery search={search} />
) : pathname === '/blocks' ? (
  <Blocks search={search} />
) : (
  <EditorPage />
);

createRoot(container).render(<StrictMode>{page}</StrictMode>);
