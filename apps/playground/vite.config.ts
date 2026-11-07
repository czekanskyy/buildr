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
