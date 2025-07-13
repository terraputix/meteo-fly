import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/leaflet/dist/images/marker-icon.png', dest: '' },
        { src: 'node_modules/leaflet/dist/images/marker-icon-2x.png', dest: '' },
        { src: 'node_modules/leaflet/dist/images/marker-shadow.png', dest: '' },
      ],
    }),
  ],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
  worker: {
    format: 'es',
  },
});
