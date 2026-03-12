import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// When deploying to GitHub Pages the site lives at /<repo-name>/.
// Set VITE_BASE env var to override (e.g. "/Crossword/"), otherwise "/" for local dev.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      manifest: {
        name: 'Kreuzwortspiel',
        short_name: 'Kreuzwort',
        description: 'Multiplayer Kreuzwortspiel für lokales WLAN',
        theme_color: '#1a5276',
        background_color: '#f0f4f8',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  build: {
    target: 'es2020'
  }
});
