import '@next-buildr/editor/styles.css';
import type { ReactNode } from 'react';

// The editor has its own root layout: no site chrome, no site stylesheet.
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
