import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Gallery } from './gallery.tsx';

const container = document.getElementById('root');
if (container === null) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <Gallery search={window.location.search} />
  </StrictMode>,
);
