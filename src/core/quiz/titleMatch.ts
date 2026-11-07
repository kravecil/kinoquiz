import type { Film } from '../types';

/**
 * Нечёткое сравнение введённого названия с каталогом (режим «Хардкор»).
 *
 * Что прощаем: регистр, «ё/е», «й/и», диакритику (Amélie), пунктуацию и кавычки,
 * пробелы и дефисы, ведущий артикль (The/A/An), слова «часть»/«part», римские цифры
 * (II → 2), опечатки (расстояние Дамерау — Левенштейна, допуск растёт с длиной),
 * ввод не в той раскладке (ytxfkj → начало).
 *
 * Что не прощаем: другие цифры («Терминатор» ≠ «Терминатор 2») и ответ, который
 * ближе к другому фильму каталога. Если ввод одинаково подходит к нескольким
 * фильмам (например, «Властелин колец»), ответ считается неоднозначным.
 */

export interface TitleEntry {
  filmId: string;
  /** Сжатая форма: нормализованный текст без пробелов. */
  compact: string;
  /** Все числа из названия по порядку — должны совпасть точно. */
  digits: string;
  /** Сколько опечаток прощаем для этого варианта. */
  tolerance: number;
  /** Часть составного названия, а не полное название или alias: при равенстве уступает им. */
  derived: boolean;
}

export interface TitleIndex {
  entries: TitleEntry[];
}

export type TitleMatch =
  | { kind: 'empty' }
  | { kind: 'none' }
  | { kind: 'match'; filmId: string; distance: number }
  | { kind: 'ambiguous'; filmIds: string[] };

export type TitleVerdict =
  | { kind: 'empty' }
  | { kind: 'correct'; distance: number }
  /** Ввод одинаково подходит к нескольким фильмам, среди них — правильный. */
  | { kind: 'ambiguous' }
  /** matchedId — фильм каталога, который игрок, судя по всему, назвал. */
  | { kind: 'wrong'; matchedId: string | null };

const ARTICLES = new Set(['the', 'a', 'an']);
const FILLER = new Set(['part', 'часть']);
// I, V и X не трогаем: это слишком часто обычные слова и буквы («X-Men», «I, Robot»).
const ROMAN: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
};

/** Приводит название к сравнимому виду: «Крёстный отец: Часть II» → «крестный отец 2». */
export function normalizeTitle(text: string): string {
  const plain = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '') // диакритика; заодно й → и
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!plain) return '';
  let words = plain.split(' ').filter((w) => !FILLER.has(w));
  if (words.length > 1 && ARTICLES.has(words[0] ?? '')) words = words.slice(1);
  return words.map((w) => ROMAN[w] ?? w).join(' ');
}

/** Допуск по числу опечаток в зависимости от длины названия (без пробелов). */
export function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 10) return 2;
  if (length <= 15) return 3;
  return 4;
}

/**
 * Варианты, которые принимаются за название: само название, aliases и части
 * составного названия («Хатико: Самый верный друг» → «Хатико», «Самый верный друг»).
 */
export function titleVariants(film: Pick<Film, 'title' | 'aliases'>): Array<{ text: string; derived: boolean }> {
  const full = [film.title, ...(film.aliases ?? [])];
  const variants = full.map((text) => ({ text, derived: false }));
  for (const source of full) {
    const parts = source.split(/\s*[:—–]\s*|,?\s+(?:или|or)\s+/i);
    if (parts.length < 2) continue;
    for (const part of parts) {
      if (normalizeTitle(part).replace(/ /g, '').length >= 4) variants.push({ text: part, derived: true });
    }
  }
  return variants;
}

export function buildTitleIndex(films: readonly Pick<Film, 'id' | 'title' | 'aliases'>[]): TitleIndex {
  const entries: TitleEntry[] = [];
  for (const film of films) {
    const seen = new Set<string>();
    for (const { text, derived } of titleVariants(film)) {
      const norm = normalizeTitle(text);
      const compact = norm.replace(/ /g, '');
      if (!compact || seen.has(compact)) continue;
      seen.add(compact);
      entries.push({ filmId: film.id, compact, digits: digitsOf(norm), tolerance: tolerance(compact.length), derived });
    }
  }
  return { entries };
}

/** Какой фильм каталога назвал игрок. */
export function matchTitle(input: string, index: TitleIndex): TitleMatch {
  const direct = matchNormalized(normalizeTitle(input), index);
  if (direct.kind !== 'none') return direct;
  // Не та раскладка: «Yfxfkj» → «Начало», «Ьфекшч» → «Matrix».
  const swapped = swapLayout(input);
  if (swapped === null) return direct;
  const retry = matchNormalized(normalizeTitle(swapped), index);
  return retry.kind === 'empty' ? direct : retry;
}

/** Проверка ответа игрока на вопрос о фильме targetId. */
export function checkTitle(input: string, targetId: string, index: TitleIndex): TitleVerdict {
  const match = matchTitle(input, index);
  switch (match.kind) {
    case 'empty':
      return { kind: 'empty' };
    case 'none':
      return { kind: 'wrong', matchedId: null };
    case 'match':
      return match.filmId === targetId
        ? { kind: 'correct', distance: match.distance }
        : { kind: 'wrong', matchedId: match.filmId };
    case 'ambiguous':
      return match.filmIds.includes(targetId) ? { kind: 'ambiguous' } : { kind: 'wrong', matchedId: null };
  }
}

function matchNormalized(norm: string, index: TitleIndex): TitleMatch {
  const compact = norm.replace(/ /g, '');
  if (!compact) return { kind: 'empty' };
  const digits = digitsOf(norm);

  // Ранг: опечатки важнее всего; при равенстве полное название побеждает часть составного.
  const best = new Map<string, { rank: number; distance: number }>();
  for (const entry of index.entries) {
    if (entry.digits !== digits) continue;
    if (Math.abs(entry.compact.length - compact.length) > entry.tolerance) continue;
    const distance = editDistance(compact, entry.compact, entry.tolerance);
    if (distance > entry.tolerance) continue;
    const rank = distance * 2 + (entry.derived ? 1 : 0);
    const prev = best.get(entry.filmId);
    if (!prev || rank < prev.rank) best.set(entry.filmId, { rank, distance });
  }
  if (best.size === 0) return { kind: 'none' };

  const min = Math.min(...[...best.values()].map((b) => b.rank));
  const winners = [...best].filter(([, b]) => b.rank === min);
  if (winners.length > 1) return { kind: 'ambiguous', filmIds: winners.map(([id]) => id) };
  const [filmId, { distance }] = winners[0] as [string, { distance: number }];
  return { kind: 'match', filmId, distance };
}

function digitsOf(norm: string): string {
  return (norm.match(/\d+/g) ?? []).map((n) => String(Number(n))).join(' ');
}

/**
 * Расстояние Дамерау — Левенштейна (вариант с перестановкой соседних букв).
 * Как только расстояние гарантированно превысило limit, возвращает limit + 1.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  const s = [...a];
  const t = [...b];
  if (Math.abs(s.length - t.length) > limit) return limit + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        v = Math.min(v, (prev2[j - 2] as number) + 1);
      }
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > limit) return limit + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[t.length] as number;
}

const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';

/** Переводит текст, набранный не в той раскладке. null — если смены раскладки не похоже. */
export function swapLayout(text: string): string | null {
  const lower = text.toLowerCase();
  const hasLatin = /[a-z]/.test(lower);
  const hasCyrillic = /[а-яё]/.test(lower);
  if (hasLatin === hasCyrillic) return null;
  const [from, to] = hasLatin ? [EN_KEYS, RU_KEYS] : [RU_KEYS, EN_KEYS];
  return [...lower]
    .map((ch) => {
      const i = from.indexOf(ch);
      return i >= 0 ? (to[i] as string) : ch;
    })
    .join('');
}
