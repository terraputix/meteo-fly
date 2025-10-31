import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const viteServerConfig = (): Plugin => ({
  name: 'add-headers',
  configureServer: (server: ViteDevServer) => {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
});

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), viteServerConfig()],
  optimizeDeps: {
    exclude: ['@openmeteo/file-reader', '@openmeteo/file-format-wasm'],
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
  worker: {
    format: 'es',
  },
});
