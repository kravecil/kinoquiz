/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * В сборке для Яндекс Игр SDK подключается статическим тегом до кода игры,
 * как описано в документации («Подключение и использование», требование 1.19.1).
 * Путь можно переопределить переменной VITE_YANDEX_SDK_SRC.
 */
function yandexSdk(src: string): Plugin {
  return {
    name: 'kinoquiz:yandex-sdk',
    transformIndexHtml: () => [{ tag: 'script', attrs: { src }, injectTo: 'head-prepend' }],
  };
}

// Яндекс Игры раздают игру из подпапки, поэтому все пути относительные (base: './').
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isYandex = env.VITE_PLATFORM === 'yandex';

  return {
    base: './',
    plugins: [preact(), ...(isYandex ? [yandexSdk(env.VITE_YANDEX_SDK_SRC || '/sdk.js')] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsInlineLimit: 4096,
      sourcemap: false,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
