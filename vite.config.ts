import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ fallback: '404.html' }),
      serviceWorker: { register: false },
    }),
  ],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: 'maplibre-vendor',
                  test: /node_modules[\\/]maplibre-gl[\\/]/,
                  priority: 20,
                },
                {
                  name: 'echarts-vendor',
                  test: /node_modules[\\/](?:echarts|zrender)[\\/]/,
                  priority: 20,
                },
              ],
            },
          },
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
  worker: {
    format: 'es',
  },
});
