import { computed } from '@preact/signals';
import { dayKey } from '@/core/save';
import {
  addTickets,
  canPlay,
  isUnlimited,
  msToNextTicket,
  spendTicket,
  syncTickets,
} from '@/core/tickets';
import type { HintType } from '@/core/types';
import { clock, config, now, save } from './app';
import { updateSave } from './persistence';

/** Билеты с учётом восстановления на текущий момент (для отображения). */
export const ticketView = computed(() => {
  const s = save.value;
  const t = clock.value;
  if (!s) return { count: 0, nextMs: 0, unlimitedMs: 0, max: config.tickets.max };
  const synced = syncTickets(s.tickets, t, config);
  return {
    count: synced.count,
    nextMs: msToNextTicket(synced, t, config),
    unlimitedMs: isUnlimited(synced, t) ? synced.unlimitedUntil - t : 0,
    max: config.tickets.max,
  };
});

export function hasTickets(): boolean {
  const s = save.value;
  return !!s && canPlay(syncTickets(s.tickets, now(), config), now());
}

/** Списывает билет за ошибку. Возвращает false, если билетов не было. */
export function loseTicket(): boolean {
  let ok = false;
  updateSave((d) => {
    const next = spendTicket(d.tickets, now(), config);
    if (next) {
      d.tickets = next;
      ok = true;
    }
  });
  return ok;
}

export function giveTickets(amount: number): void {
  updateSave((d) => {
    d.tickets = addTickets(d.tickets, amount, now(), config);
  });
}

export function giveCoins(amount: number): void {
  updateSave((d) => {
    d.coins += amount;
  });
}

/**
 * Оплата подсказки: сначала из запаса, иначе жетонами.
 * Возвращает false, если не хватает жетонов.
 */
export function payForHint(type: HintType): boolean {
  const s = save.value;
  if (!s) return false;
  if (s.hints[type] > 0) {
    updateSave((d) => {
      d.hints[type] -= 1;
    });
    return true;
  }
  const cost = config.hints.cost[type];
  if (s.coins < cost) return false;
  updateSave((d) => {
    d.coins -= cost;
  });
  return true;
}

/** Ежедневный бонус: возвращает размер бонуса или 0, если уже выдан сегодня. */
export function claimDailyBonus(): number {
  const s = save.value;
  if (!s) return 0;
  const today = dayKey(now());
  if (s.lastDailyBonus === today) return 0;
  const isFirstDay = s.lastDailyBonus === null && s.stats.games === 0;
  updateSave((d) => {
    d.lastDailyBonus = today;
    if (!isFirstDay) d.coins += config.coins.dailyBonus;
  });
  // В самый первый запуск бонус не выдаём: у новичка и так стартовые жетоны.
  return isFirstDay ? 0 : config.coins.dailyBonus;
}
