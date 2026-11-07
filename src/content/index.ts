import type { Film, FilmMeta } from '@/core/types';
import { findLanguage } from '@/i18n/languages';
import filmsMeta from './films.json';

const META = filmsMeta as FilmMeta[];

/**
 * Собирает фильмы для языка: общие метаданные + переводимые тексты.
 * Фильмы без перевода на этот язык не попадают в игру (никакой смеси языков).
 */
export async function loadFilms(lang: string): Promise<Film[]> {
  const texts = await findLanguage(lang).content();
  return META.flatMap((meta) => {
    const text = texts[meta.id];
    return text ? [{ ...meta, ...text }] : [];
  });
}
