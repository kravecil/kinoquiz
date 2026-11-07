import { signal } from '@preact/signals';
import { MarathonRun, type RunSnapshot } from '@/core/quiz/marathon';
import { createRng, randomSeed } from '@/core/rng';
import type { HintType } from '@/core/types';
import { play } from '@/audio/sfx';
import { t } from '@/i18n';
import { config, films, modal, navigate, now, platform, save, showToast } from './app';
import { giveCoins, giveTickets, hasTickets, loseTicket, payForHint } from './economy';
import { flushSave, updateSave } from './persistence';
import { showRewarded } from './ads';
import { submitBestScore } from './leaderboard';

/**
 * Контроллер сеанса: связывает ядро (MarathonRun) с экономикой, площадкой и экранами.
 */

export interface RunResult {
  score: number;
  correct: number;
  bestStreak: number;
  coinsEarned: number;
  isRecord: boolean;
  coinsDoubled: boolean;
}

let run: MarathonRun | null = null;
export const runState = signal<RunSnapshot | null>(null);
export const lastResult = signal<RunResult | null>(null);
/** Счётчик сеансов: меняется при каждом старте, чтобы проиграть анимацию занавеса. */
export const runId = signal(0);

function sync(): void {
  runState.value = run?.snapshot() ?? null;
}

export function startRun(): void {
  if (!hasTickets()) {
    modal.value = { kind: 'noTickets' };
    return;
  }
  const seen = new Set(save.value?.seen ?? []);
  run = new MarathonRun(films.value, createRng(randomSeed()), config, seen);
  run.start(now());
  runId.value += 1;
  lastResult.value = null;
  sync();
  navigate('game');
  platform().gameplayStart();
  play('reel');
}

export function answer(optionId: string): void {
  if (!run) return;
  const result = run.answer(optionId, now());
  if (result.kind === 'correct') {
    play('correct');
    giveCoins(result.coins);
    updateSave((d) => {
      d.stats.totalCorrect += 1;
    });
  } else if (result.kind === 'saved') {
    play('wrong');
    showToast(t('game.saved'), 'info');
  } else {
    play('wrong');
    loseTicket();
  }
  sync();
}

/** «Дальше»: следующий вопрос или предложение продолжить, если билеты кончились. */
export function proceed(): void {
  if (!run) return;
  const snap = run.snapshot();
  if (snap.phase === 'complete') {
    showToast(t('game.complete'), 'good');
    void endRun();
    return;
  }
  if (snap.lastResult?.kind === 'wrong' && !hasTickets()) {
    if (run.canRevive()) {
      platform().gameplayStop();
      modal.value = { kind: 'revive' };
    } else {
      void endRun();
    }
    return;
  }
  run.next(now());
  play('tap');
  sync();
  if (run.snapshot().phase === 'complete') {
    showToast(t('game.complete'), 'good');
    void endRun();
  }
}

export function useHint(type: HintType): void {
  if (!run || !run.canUseHint(type)) return;
  if (!payForHint(type)) {
    showToast(t('game.notEnoughCoins'), 'bad');
    return;
  }
  run.useHint(type, now());
  play(type === 'skip' ? 'reel' : 'tap');
  sync();
}

export function canUseHint(type: HintType): boolean {
  // Читаем runState, чтобы компоненты подписывались на изменения.
  return !!runState.value && !!run?.canUseHint(type);
}

/** Продолжение сеанса за рекламу, когда закончились билеты. */
export async function reviveWithAd(): Promise<void> {
  if (!run) return;
  const rewarded = await showRewarded();
  if (!rewarded) return;
  run.markRevive();
  giveTickets(config.tickets.perAd);
  modal.value = null;
  platform().gameplayStart();
  proceed();
}

/** Вернуться в игру после покупки билетов в кассе. */
export function resumeAfterShop(): void {
  if (!run) return;
  if (hasTickets()) {
    modal.value = null;
    platform().gameplayStart();
    proceed();
  } else {
    modal.value = { kind: 'revive' };
  }
}

export async function endRun(): Promise<void> {
  if (!run) return;
  const snap = run.snapshot();
  const shown = run.shownKeys;
  run = null;
  modal.value = null;
  platform().gameplayStop();

  const prevBest = save.value?.stats.bestScore ?? 0;
  const isRecord = snap.score > prevBest;
  updateSave((d) => {
    d.stats.games += 1;
    d.stats.bestScore = Math.max(d.stats.bestScore, snap.score);
    d.stats.bestStreak = Math.max(d.stats.bestStreak, snap.bestStreak);
    // Помним последние 2000 показанных вопросов.
    d.seen = [...new Set([...d.seen, ...shown])].slice(-2000);
  });
  await flushSave();

  lastResult.value = {
    score: snap.score,
    correct: snap.correct,
    bestStreak: snap.bestStreak,
    coinsEarned: snap.coinsEarned,
    isRecord,
    coinsDoubled: false,
  };
  runState.value = null;
  navigate('result');
  if (isRecord) void submitBestScore();
}

export async function doubleCoins(): Promise<void> {
  const result = lastResult.value;
  if (!result || result.coinsDoubled || result.coinsEarned === 0) return;
  if (!(await showRewarded())) return;
  giveCoins(result.coinsEarned);
  lastResult.value = { ...result, coinsDoubled: true };
  play('coin');
  showToast(t('result.doubled'), 'good');
}

export function isRunActive(): boolean {
  return run !== null;
}
