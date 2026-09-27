import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// Single-page app: adapter-static (see src/routes/+layout.ts) serves everything from one
// fallback page, so the router owns navigation and the audio graph in the root layout never
// remounts. In dev, /v1 (and friends) proxy straight to the naad engine.
const ENGINE_URL = process.env.NAAD_ENGINE_URL ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter({ fallback: '200.html' }),
    }),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      kit: { spa: true, adapterFallback: '200.html' },
      manifest: {
        name: 'NAAD',
        short_name: 'NAAD',
        description: 'NAAD — a self-hosted, quality-first music player.',
        theme_color: '#141312',
        background_color: '#141312',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Audio is fetched live; only the app shell is precached.
        globPatterns: ['client/**/*.{js,css,ico,svg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/v1\//],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': { target: ENGINE_URL, changeOrigin: true },
      '/healthz': { target: ENGINE_URL, changeOrigin: true },
      '/docs': { target: ENGINE_URL, changeOrigin: true },
    },
  },
});
