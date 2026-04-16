import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  const outDir = mode === 'standalone' ? './dist' : '../server/dist/public'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'icon-192.png',
          'icon-512.png',
          'logo-sidebar.png',
        ],
        manifest: {
          name: 'HukukTakip - Buro Yonetim Sistemi',
          short_name: 'HukukTakip',
          description:
            'Avukatlik Buro Yonetim Sistemi - Dava, durusma, gorev ve tahsilat takibi',
          start_url: '/dashboard',
          scope: '/',
          display: 'standalone',
          background_color: '#0f1f33',
          theme_color: '#1e3a5f',
          orientation: 'any',
          lang: 'tr',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          // Tum build ciktisi (JS, CSS, HTML, assets) precache'lenir.
          // Hashed asset'ler 1 yil immutable cache'de kalir — Workbox zaten cache-busting'i
          // filename hash'i ile yapar, revision: null guvenli.
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff,woff2}'],
          cleanupOutdatedCaches: true,
          // SPA fallback: offline iken herhangi bir route index.html servis eder
          navigateFallback: '/index.html',
          // API istekleri navigateFallback'ten muaf (aksi halde 404 HTML donerdi)
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              // Ayni origin API: NetworkFirst + kisa timeout; offline'da stale veri gosterir.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'hukuk-api',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 gun
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // VITE_API_BASE_URL ile ayri origin backend kullanildiginda (Vercel+Render).
              urlPattern: ({ url }) => /\/api\//.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'hukuk-api-external',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Google Fonts stylesheet — StaleWhileRevalidate.
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Google Fonts dosyalari — CacheFirst, 1 yil.
              urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        // Dev modda SW'yi etkinlestirme (HMR'yi bozar)
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
        '@hukuk-takip/shared': path.resolve(__dirname, '../shared/dist/index.js'),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const setCookie = proxyRes.headers['set-cookie']
              if (setCookie) {
                proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) =>
                  cookie.replace(/; secure/gi, '')
                )
              }
            })
          },
        },
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-charts': ['recharts'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-popover',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-alert-dialog',
            ],
          },
        },
      },
    },
  }
})
