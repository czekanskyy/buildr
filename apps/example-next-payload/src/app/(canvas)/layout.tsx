import '@next-buildr/components/styles.css';
import type { ReactNode } from 'react';

// The canvas shows the site's own styles, so it loads the same stylesheet as the public layout.
export default function CanvasLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
