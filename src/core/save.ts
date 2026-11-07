import type { GameConfig } from './config';
import type { HintType } from './types';
import type { TicketState } from './tickets';

export const SAVE_VERSION = 1;

/** Всё, что сохраняется между сессиями (облако площадки + localStorage как запас). */
export interface SaveData {
  version: number;
  coins: number;
  tickets: TicketState;
  hints: Record<HintType, number>;
  /** Ключи вопросов, которые игрок уже видел. */
  seen: string[];
  stats: {
    games: number;
    /** Рекорд марафона — он же идёт в рейтинг площадки. */
    bestScore: number;
    /** Рекорд хардкора (пока только локальный, без рейтинга). */
    bestScoreHardcore: number;
    totalCorrect: number;
    bestStreak: number;
  };
  settings: {
    sound: boolean;
    /** null — язык определяется автоматически. */
    lang: string | null;
  };
  /** Купленное отключение полноэкранной рекламы. */
  noAds: boolean;
  /** День (YYYY-MM-DD), когда последний раз выдан ежедневный бонус. */
  lastDailyBonus: string | null;
  /** Токены покупок, которые уже выданы (защита от двойного начисления). */
  grantedPurchases: string[];
  /** Отметка последнего изменения — для выбора между облаком и локальной копией. */
  savedAt: number;
}

const HINT_TYPES: HintType[] = ['fifty', 'year', 'genre', 'director', 'skip', 'shield'];

export function createSave(now: number, cfg: GameConfig): SaveData {
  const hints = Object.fromEntries(HINT_TYPES.map((h) => [h, cfg.hints.starter[h] ?? 0])) as Record<
    HintType,
    number
  >;
  return {
    version: SAVE_VERSION,
    coins: cfg.coins.start,
    tickets: { count: cfg.tickets.max, updatedAt: now, unlimitedUntil: 0 },
    hints,
    seen: [],
    stats: { games: 0, bestScore: 0, bestScoreHardcore: 0, totalCorrect: 0, bestStreak: 0 },
    settings: { sound: true, lang: null },
    noAds: false,
    lastDailyBonus: null,
    grantedPurchases: [],
    savedAt: now,
  };
}

/**
 * Приводит сохранение любой версии (или мусор) к актуальному виду.
 * Неизвестные и битые поля заменяются значениями по умолчанию.
 */
export function migrateSave(raw: unknown, now: number, cfg: GameConfig): SaveData {
  const base = createSave(now, cfg);
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<SaveData>;

  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  return {
    version: SAVE_VERSION,
    coins: Math.max(0, num(data.coins, base.coins)),
    tickets: {
      count: Math.max(0, num(data.tickets?.count, base.tickets.count)),
      updatedAt: num(data.tickets?.updatedAt, now),
      unlimitedUntil: num(data.tickets?.unlimitedUntil, 0),
    },
    hints: Object.fromEntries(
      HINT_TYPES.map((h) => [h, Math.max(0, num(data.hints?.[h], base.hints[h]))]),
    ) as Record<HintType, number>,
    seen: Array.isArray(data.seen) ? data.seen.filter((s): s is string => typeof s === 'string') : [],
    stats: {
      games: num(data.stats?.games, 0),
      bestScore: num(data.stats?.bestScore, 0),
      bestScoreHardcore: num(data.stats?.bestScoreHardcore, 0),
      totalCorrect: num(data.stats?.totalCorrect, 0),
      bestStreak: num(data.stats?.bestStreak, 0),
    },
    settings: {
      sound: typeof data.settings?.sound === 'boolean' ? data.settings.sound : true,
      lang: typeof data.settings?.lang === 'string' ? data.settings.lang : null,
    },
    noAds: data.noAds === true,
    lastDailyBonus: typeof data.lastDailyBonus === 'string' ? data.lastDailyBonus : null,
    grantedPurchases: Array.isArray(data.grantedPurchases)
      ? data.grantedPurchases.filter((s): s is string => typeof s === 'string').slice(-200)
      : [],
    savedAt: num(data.savedAt, 0),
  };
}

/** Из двух копий (облако и локальная) берём более свежую. */
export function newerSave(a: SaveData | null, b: SaveData | null): SaveData | null {
  if (!a) return b;
  if (!b) return a;
  return a.savedAt >= b.savedAt ? a : b;
}

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
