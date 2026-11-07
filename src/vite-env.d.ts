/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Целевая площадка сборки: `yandex` или `local`. */
  readonly VITE_PLATFORM?: 'yandex' | 'local';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
