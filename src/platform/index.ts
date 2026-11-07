import type { IPlatform } from './types';
import { LocalPlatform } from './local/LocalPlatform';
import { YandexPlatform } from './yandex/YandexPlatform';

export type { IPlatform } from './types';

/**
 * Площадка выбирается при сборке переменной VITE_PLATFORM:
 *   - `npm run dev`, `npm run build:standalone` → local (заглушка);
 *   - `npm run build` → yandex (подключается /sdk.js).
 */
export function createPlatform(): IPlatform {
  if (import.meta.env.VITE_PLATFORM === 'yandex') return new YandexPlatform();
  return new LocalPlatform();
}
