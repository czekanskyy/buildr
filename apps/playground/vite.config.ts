import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'static-block-fixtures',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          if (url.pathname === '/blocks' && url.searchParams.has('captchaCsp')) {
            try {
              const nonce = randomBytes(18).toString('base64');
              const carrier = url.searchParams.get('captchaCsp');
              let html = await server.transformIndexHtml(
                req.url ?? '/blocks',
                await readFile(new URL('./index.html', import.meta.url), 'utf8'),
              );
              // Hash the Vite refresh preamble so the app boots even in the missing-carrier case.
              const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
                .filter((match) => match[1]?.trim())
                .map(
                  (match) =>
                    `'sha256-${createHash('sha256')
                      .update(match[1] ?? '')
                      .digest('base64')}'`,
                );
              if (carrier === 'script') {
                html = html.replace('<script ', `<script nonce="${nonce}" `);
              } else if (carrier === 'meta') {
                html = html.replace('</head>', `<meta name="csp-nonce" content="${nonce}"></head>`);
              }
              // script-src-elem deliberately tightens the host allowlist: provider tags need the
              // nonce. No strict-dynamic: a trusted app script must not bypass this negative test.
              res.setHeader(
                'Content-Security-Policy',
                `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; ` +
                  `script-src-elem 'self' 'nonce-${nonce}' ${hashes.join(' ')}; ` +
                  'frame-src https://challenges.cloudflare.com',
              );
              res.setHeader('Cache-Control', 'no-store');
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
            } catch (error) {
              next(error);
            }
            return;
          }
          if (url.pathname !== '/blocks' || url.searchParams.get('static') !== '1') return next();
          try {
            const module = await server.ssrLoadModule('/src/blocks-static.tsx');
            const stylesheet =
              '/@fs/' +
              fileURLToPath(
                new URL('../../packages/components/src/styles.css', import.meta.url),
              ).replaceAll('\\', '/');
            // biome-ignore lint/complexity/useLiteralKeys: SSR module exports use an index signature.
            const html = await module['renderStaticBlocks'](url.search, stylesheet);
            if (html === undefined) return next();
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
  server: { port: 5173, strictPort: true },
});
