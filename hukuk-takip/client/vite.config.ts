import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const outDir = mode === 'standalone' ? './dist' : '../server/dist/public'

  return {
    plugins: [react()],
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
    },
  }
})
