import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  // Enable JSX processing
  oxc: {
    // We need to use _m as the imported name so that it doesn't collide with
    // explicitly importing _m, while still allowing us to have organizeImports
    // strip out "unused" mithril imports
    jsxInject: "import _m from 'mithril'",
    jsx: {
      runtime: 'classic',
      pragma: '_m',
      pragmaFrag: '_m.Fragment'
    }
  },
  plugins: [
    VitePWA({
      filename: 'service-worker.js',
      workbox: {
        // Add additional file types to be precached by service worker (by
        // default, the service worker caches *.css, *.js, and *.html; see
        // <https://vite-pwa-org.netlify.app/guide/service-worker-precache.html#precache-manifest>;
        // it's also worth noting that the webmanifest defined later in this
        // file is automatically precached by Vite PWA (i.e. there is no need to
        // include *.webmanifest in the glob patterns list here)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // A nice-to-have optimization for purging old cache entries after the
        // service worker has updated; see:
        // <https://vite-pwa-org.netlify.app/guide/prompt-for-update.html#cleanup-outdated-caches>
        cleanupOutdatedCaches: true
      },
      // Web App Manifest (will be generated as manifest.webmanifest; the
      // relevant <link> tag will be automatically added to index.html during
      // build)
      manifest: {
        short_name: 'Connect Four | BwC',
        name: 'Connect Four | Built with Cory',
        description:
          'Connect Four by Built with Cory (BwC). Play on your phone or computer, with a friend or against Mr. A.I.',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          {
            src: 'icons/app-icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'icons/app-icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});
