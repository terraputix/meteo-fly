import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
	plugins: [
		sveltekit(),
		viteStaticCopy({
			targets: [
				{ src: 'node_modules/leaflet/dist/images/marker-icon.png', dest: '' },
				{ src: 'node_modules/leaflet/dist/images/marker-icon-2x.png', dest: '' },
				{ src: 'node_modules/leaflet/dist/images/marker-shadow.png', dest: '' }
			]
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
