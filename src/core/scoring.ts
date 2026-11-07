import type { GameConfig } from './config';
import type { Difficulty } from './types';

export interface ScoreInput {
  difficulty: Difficulty;
  /** Сколько секунд игрок думал над вопросом. */
  answerSec: number;
  /** Длина серии с учётом текущего ответа (1 = первый верный подряд). */
  streak: number;
  hintsUsed: number;
  /** Своё время на полный бонус скорости (по умолчанию из cfg.score). */
  fastAnswerSec?: number;
  /** Множитель режима (хардкор). */
  multiplier?: number;
}

export function streakMultiplier(streak: number, cfg: GameConfig): number {
  const { streakStep, streakMaxMultiplier } = cfg.score;
  return Math.min(streakMaxMultiplier, 1 + streakStep * Math.max(0, streak - 1));
}

export function scoreFor(input: ScoreInput, cfg: GameConfig): number {
  const { base, speedBonus, hintPenalty, minShare } = cfg.score;
  const fastAnswerSec = input.fastAnswerSec ?? cfg.score.fastAnswerSec;
  const speed = speedBonus * clamp01(1 - input.answerSec / fastAnswerSec);
  const hintShare = Math.max(minShare, 1 - hintPenalty * input.hintsUsed);
  const raw =
    base[input.difficulty] *
    (1 + speed) *
    streakMultiplier(input.streak, cfg) *
    hintShare *
    (input.multiplier ?? 1);
  return Math.round(raw / 5) * 5;
}

export function coinsFor(difficulty: Difficulty, streak: number, cfg: GameConfig, multiplier = 1): number {
  const { perCorrect, streakBonusEvery, streakBonus } = cfg.coins;
  const bonus = streak > 0 && streak % streakBonusEvery === 0 ? streakBonus : 0;
  return Math.round(perCorrect[difficulty] * multiplier) + bonus;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
