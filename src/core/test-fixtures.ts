import type { Film, Genre, Popularity } from './types';

/** Небольшая искусственная база для тестов ядра. */
export function makeFilms(count: number): Film[] {
  const genres: Genre[] = ['drama', 'comedy', 'scifi', 'crime', 'animation', 'thriller'];
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i}`,
    year: 1960 + ((i * 7) % 60),
    genres: [genres[i % genres.length] as Genre],
    countries: ['US'],
    popularity: ((i % 3) + 1) as Popularity,
    title: `Film ${i}`,
    director: `Director ${i}`,
    descriptions: [`Easy ${i}`, `Hard ${i}`],
  }));
}
