import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPage } from './editor.tsx';
import { Gallery } from './gallery.tsx';

const container = document.getElementById('root');
if (container === null) throw new Error('#root is missing from index.html');

const editor = window.location.pathname.startsWith('/editor');

createRoot(container).render(
  <StrictMode>{editor ? <EditorPage /> : <Gallery search={window.location.search} />}</StrictMode>,
);
