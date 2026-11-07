import { signal } from '@preact/signals';
import type { LeaderboardData } from '@/platform/types';
import { platform, save } from './app';

export type LeaderboardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: LeaderboardData }
  | { status: 'error' };

export const leaderboard = signal<LeaderboardState>({ status: 'idle' });
export const authorized = signal(false);

/** Ограничение площадки: не чаще раза в секунду. Плюс не шлём один и тот же счёт повторно. */
let lastSubmitted = -1;
let lastSubmitAt = 0;

export async function submitBestScore(): Promise<void> {
  const best = save.value?.stats.bestScore ?? 0;
  if (best <= 0 || best === lastSubmitted) return;
  if (!platform().auth.isAuthorized()) return;
  if (Date.now() - lastSubmitAt < 1100) return;
  lastSubmitAt = Date.now();
  try {
    await platform().leaderboard.submit(best);
    lastSubmitted = best;
  } catch (err) {
    console.warn('[leaderboard] submit', err);
  }
}

export async function loadLeaderboard(): Promise<void> {
  leaderboard.value = { status: 'loading' };
  try {
    const data = await platform().leaderboard.load();
    leaderboard.value = { status: 'ready', data };
  } catch {
    leaderboard.value = { status: 'error' };
  }
}

/** Вход: после него отправляем рекорд, накопленный без авторизации. */
export async function login(): Promise<boolean> {
  const ok = await platform().auth.login();
  authorized.value = platform().auth.isAuthorized();
  if (ok) await submitBestScore();
  return ok;
}

export function refreshAuth(): void {
  authorized.value = platform().auth.isAuthorized();
}
