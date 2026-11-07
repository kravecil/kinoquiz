import type { Difficulty, HintType } from './types';

/**
 * Игровой баланс в одном месте. На втором этапе значения можно будет
 * переопределять через удалённые флаги Яндекс Игр без пересборки.
 */
export interface GameConfig {
  tickets: {
    max: number;
    /** Минут на восстановление одного билета. */
    regenMinutes: number;
    /** Сколько билетов даёт одна реклама. */
    perAd: number;
  };
  coins: {
    start: number;
    perCorrect: Record<Difficulty, number>;
    /** Бонус за каждые N правильных ответов подряд. */
    streakBonusEvery: number;
    streakBonus: number;
    dailyBonus: number;
    /** Жетоны за просмотр рекламы в кассе. */
    perAd: number;
  };
  score: {
    base: Record<Difficulty, number>;
    /** Время, за которое начисляется полный бонус скорости, секунды. */
    fastAnswerSec: number;
    /** Максимальный бонус за скорость (доля от базы). */
    speedBonus: number;
    /** Прирост множителя за каждый ответ серии. */
    streakStep: number;
    streakMaxMultiplier: number;
    /** Штраф к очкам за каждую подсказку (доля). */
    hintPenalty: number;
    minShare: number;
  };
  hints: {
    cost: Record<HintType, number>;
    /** Сколько подсказок каждого типа даётся новичку. */
    starter: Partial<Record<HintType, number>>;
  };
  marathon: {
    /** До какого номера вопроса какая максимальная сложность. */
    ramp: Array<{ untilQuestion: number; maxDifficulty: Difficulty }>;
    /** Сколько раз за забег можно продолжить после проигрыша за рекламу. */
    revivesPerRun: number;
  };
  ads: {
    /** Минимальный интервал между полноэкранной рекламой, секунды (поверх лимита площадки). */
    interstitialCooldownSec: number;
  };
}

export const defaultConfig: GameConfig = {
  tickets: { max: 5, regenMinutes: 20, perAd: 1 },
  coins: {
    start: 100,
    perCorrect: { 1: 2, 2: 3, 3: 4, 4: 6 },
    streakBonusEvery: 5,
    streakBonus: 10,
    dailyBonus: 30,
    perAd: 20,
  },
  score: {
    base: { 1: 100, 2: 150, 3: 200, 4: 300 },
    fastAnswerSec: 8,
    speedBonus: 0.5,
    streakStep: 0.1,
    streakMaxMultiplier: 2,
    hintPenalty: 0.25,
    minShare: 0.25,
  },
  hints: {
    cost: { fifty: 30, year: 20, genre: 15, director: 40, skip: 35, shield: 50 },
    starter: { fifty: 2, year: 1, skip: 1 },
  },
  marathon: {
    ramp: [
      { untilQuestion: 5, maxDifficulty: 2 },
      { untilQuestion: 12, maxDifficulty: 3 },
      { untilQuestion: Infinity, maxDifficulty: 4 },
    ],
    revivesPerRun: 1,
  },
  ads: { interstitialCooldownSec: 90 },
};
