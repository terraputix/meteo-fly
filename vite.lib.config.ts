import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: true } })],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    lib: {
      entry: 'src/lib/components/WindChartPlugin.svelte',
      name: 'WindChartPlugin',
      fileName: 'wind-chart-plugin',
      formats: ['umd'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // Required for UMD
      },
    },
  },
});
