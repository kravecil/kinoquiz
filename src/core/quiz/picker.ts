import type { DescriptionLevel, Difficulty, Film, QuizQuestion } from '../types';
import type { Rng } from '../rng';

export const OPTIONS_COUNT = 4;

export function difficultyOf(film: Film, level: DescriptionLevel): Difficulty {
  const raw = film.popularity + level - 1;
  return Math.min(4, Math.max(1, raw)) as Difficulty;
}

export function questionKey(filmId: string, level: DescriptionLevel): string {
  return `${filmId}:${level}`;
}

interface Candidate {
  film: Film;
  level: DescriptionLevel;
  difficulty: Difficulty;
  key: string;
}

export interface PickOptions {
  films: readonly Film[];
  rng: Rng;
  maxDifficulty: Difficulty;
  /** Фильмы, уже показанные в текущем забеге (не повторяем). */
  usedInRun: ReadonlySet<string>;
  /** Ключи вопросов, которые игрок уже видел когда-либо (стараемся не повторять). */
  seen: ReadonlySet<string>;
}

/**
 * Выбирает следующий вопрос. Приоритет: невиденные вопросы, сложность ближе к
 * текущему потолку (чтобы игра постепенно усложнялась). Возвращает null, если
 * в забеге закончились фильмы.
 */
export function pickQuestion(opts: PickOptions): QuizQuestion | null {
  const { films, rng, maxDifficulty, usedInRun, seen } = opts;

  const all: Candidate[] = [];
  for (const film of films) {
    if (usedInRun.has(film.id)) continue;
    for (const level of [1, 2] as const) {
      const difficulty = difficultyOf(film, level);
      all.push({ film, level, difficulty, key: questionKey(film.id, level) });
    }
  }
  if (all.length === 0) return null;

  // Если подходящих по сложности нет (маленькая база), берём самые лёгкие из оставшихся.
  let pool = all.filter((c) => c.difficulty <= maxDifficulty);
  if (pool.length === 0) {
    const minD = Math.min(...all.map((c) => c.difficulty));
    pool = all.filter((c) => c.difficulty === minD);
  }

  const unseen = pool.filter((c) => !seen.has(c.key));
  if (unseen.length > 0) pool = unseen;

  const chosen = weightedPick(pool, (c) => 1 + Math.max(0, 2 - (maxDifficulty - c.difficulty)), rng);
  const decoys = pickDecoys(chosen.film, films, rng, OPTIONS_COUNT - 1);

  return {
    key: chosen.key,
    film: chosen.film,
    level: chosen.level,
    text: chosen.film.descriptions[chosen.level - 1] ?? chosen.film.descriptions[0],
    difficulty: chosen.difficulty,
    options: rng.shuffle([chosen.film.id, ...decoys.map((f) => f.id)]),
  };
}

function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = rng.next() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  return items[items.length - 1] as T;
}

/**
 * Подбирает правдоподобные неверные варианты: похожий жанр и близкие годы.
 * Так вопрос не решается методом исключения («Титаник» среди мультфильмов).
 */
export function pickDecoys(target: Film, films: readonly Film[], rng: Rng, count: number): Film[] {
  const others = films.filter((f) => f.id !== target.id && normalize(f.title) !== normalize(target.title));
  // Мультфильмы и игровое кино не смешиваем, если хватает вариантов того же типа.
  const isAnim = (f: Film) => f.genres.includes('animation');
  const sameKind = others.filter((f) => isAnim(f) === isAnim(target));
  const base = sameKind.length >= count ? sameKind : others;

  const scored = base
    .map((f) => ({ film: f, score: similarity(target, f) + rng.next() * 2 }))
    .sort((a, b) => b.score - a.score);

  // Берём случайные из верхней части списка, чтобы варианты не повторялись от раза к разу.
  const top = scored.slice(0, Math.max(count * 2, 6));
  return rng.shuffle(top).slice(0, count).map((s) => s.film);
}

function similarity(a: Film, b: Film): number {
  const sharedGenres = a.genres.filter((g) => b.genres.includes(g)).length;
  const yearGap = Math.abs(a.year - b.year);
  const yearScore = yearGap <= 5 ? 2 : yearGap <= 15 ? 1 : 0;
  const animationMismatch = a.genres.includes('animation') !== b.genres.includes('animation') ? -3 : 0;
  return sharedGenres * 2 + yearScore + animationMismatch;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
