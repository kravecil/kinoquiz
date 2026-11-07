/**
 * Базовые типы предметной области. Модуль core не зависит ни от DOM, ни от SDK площадки.
 */

export type Genre =
  | 'drama'
  | 'comedy'
  | 'crime'
  | 'thriller'
  | 'scifi'
  | 'fantasy'
  | 'adventure'
  | 'action'
  | 'animation'
  | 'family'
  | 'romance'
  | 'war'
  | 'horror'
  | 'mystery'
  | 'biography'
  | 'history'
  | 'musical'
  | 'western';

/** 1 — знают все, 2 — известный, 3 — для киноманов. */
export type Popularity = 1 | 2 | 3;

/** 1 — описание с явными зацепками, 2 — абстрактное описание. */
export type DescriptionLevel = 1 | 2;

/** Общие для всех языков данные о фильме. */
export interface FilmMeta {
  id: string;
  year: number;
  genres: Genre[];
  /** Коды стран ISO 3166-1 alpha-2 (название берём из Intl.DisplayNames). */
  countries: string[];
  popularity: Popularity;
}

/** Переводимая часть: своя для каждого языка. */
export interface FilmText {
  title: string;
  /** Допустимые варианты написания (для будущего режима ввода). */
  aliases?: string[];
  director: string;
  /** Описания по уровням: [лёгкое, сложное]. */
  descriptions: [string, string];
}

export type FilmTexts = Record<string, FilmText>;

export interface Film extends FilmMeta, FilmText {}

/** Итоговая сложность вопроса: 1..4. */
export type Difficulty = 1 | 2 | 3 | 4;

export interface QuizQuestion {
  /** Уникальный ключ вопроса: `${filmId}:${level}`. */
  key: string;
  film: Film;
  level: DescriptionLevel;
  text: string;
  difficulty: Difficulty;
  /** Варианты ответа (id фильмов), перемешаны. */
  options: string[];
}

/** classic — четыре билета-варианта; hardcore — название вписывается вручную. */
export type GameMode = 'classic' | 'hardcore';

export type HintType = 'fifty' | 'year' | 'genre' | 'director' | 'skip' | 'shield';
