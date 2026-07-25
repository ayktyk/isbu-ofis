/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUILD_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// vite.config.ts `define` ile her derlemede enjekte edilir (Vercel commit SHA
// veya derleme zamani). Kalici React Query onbelleginin buster'i olarak
// kullanilir — degeri degisince eski onbellek atilir.
declare const __BUILD_ID__: string
