import type { ReactNode } from 'react';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
