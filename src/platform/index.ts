import type { IPlatform } from './types';
import { LocalPlatform } from './local/LocalPlatform';

export type { IPlatform } from './types';

/**
 * Выбор площадки. На втором этапе здесь появится YandexPlatform: она будет
 * выбираться, когда игра запущена внутри Яндекс Игр (доступен YaGames).
 */
export function createPlatform(): IPlatform {
  return new LocalPlatform();
}
