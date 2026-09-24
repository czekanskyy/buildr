import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasPage } from './canvas.tsx';
import { EditorPage } from './editor.tsx';
import { Gallery } from './gallery.tsx';

const container = document.getElementById('root');
if (container === null) throw new Error('#root is missing from index.html');

const { pathname, search } = window.location;
const page = pathname.startsWith('/canvas') ? (
  <CanvasPage />
) : pathname.startsWith('/gallery') ? (
  <Gallery search={search} />
) : (
  <EditorPage />
);

createRoot(container).render(<StrictMode>{page}</StrictMode>);
