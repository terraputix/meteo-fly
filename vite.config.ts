import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
