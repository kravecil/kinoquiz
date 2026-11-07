import type { FilmTexts } from '@/core/types';
import type { Dictionary } from './types';

/**
 * Реестр языков. Чтобы добавить язык:
 *   1. создать src/i18n/locales/<code>.ts (можно частичный — недостающее возьмётся из fallback);
 *   2. создать src/content/texts/<code>.json с переводом названий и описаний;
 *   3. добавить строку в LANGUAGES ниже.
 * Скрипт `npm run content:check` покажет, чего не хватает.
 */
export interface LanguageDef {
  code: string;
  /** Самоназвание языка для меню настроек. */
  name: string;
  /** Если строки нет в этом языке, берём из fallback. */
  fallback: string | null;
  dictionary: () => Promise<Partial<Dictionary>>;
  content: () => Promise<FilmTexts>;
}

export const BASE_LANG = 'ru';

export const LANGUAGES: LanguageDef[] = [
  {
    code: 'ru',
    name: 'Русский',
    fallback: null,
    dictionary: () => import('./locales/ru').then((m) => m.default),
    content: () => import('@/content/texts/ru.json').then((m) => m.default as unknown as FilmTexts),
  },
  {
    code: 'en',
    name: 'English',
    fallback: 'ru',
    dictionary: () => import('./locales/en').then((m) => m.default),
    content: () => import('@/content/texts/en.json').then((m) => m.default as unknown as FilmTexts),
  },
];

/** Языки, для которых по умолчанию показываем русский (если своего перевода нет). */
const RUSSIAN_SPEAKING = ['ru', 'be', 'kk', 'uk', 'uz', 'ky', 'tg', 'hy', 'az'];

/** Подбирает поддерживаемый язык по коду площадки или браузера. */
export function resolveLang(raw: string | null | undefined): string {
  const code = (raw ?? '').toLowerCase().slice(0, 2);
  if (LANGUAGES.some((l) => l.code === code)) return code;
  if (RUSSIAN_SPEAKING.includes(code)) return 'ru';
  return 'en';
}

export function findLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? (LANGUAGES[0] as LanguageDef);
}
