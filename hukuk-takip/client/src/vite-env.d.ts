/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUILD_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
