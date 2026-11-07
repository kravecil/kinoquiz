import type { GameConfig } from './config';

/**
 * Билеты — жизни игрока. Восстанавливаются по одному каждые N минут, пока их
 * меньше максимума. Купленные билеты могут превышать максимум (тогда восстановление
 * просто не идёт). Время всегда передаётся снаружи — на площадке это серверное время.
 */
export interface TicketState {
  count: number;
  /** Отметка времени, от которой отсчитывается восстановление следующего билета. */
  updatedAt: number;
  /** До какого момента действует безлимит (0 — не действует). */
  unlimitedUntil: number;
}

const MINUTE = 60_000;

export function regenMs(cfg: GameConfig): number {
  return cfg.tickets.regenMinutes * MINUTE;
}

export function isUnlimited(state: TicketState, now: number): boolean {
  return state.unlimitedUntil > now;
}

/** Начисляет восстановленные билеты на момент now. */
export function syncTickets(state: TicketState, now: number, cfg: GameConfig): TicketState {
  const { max } = cfg.tickets;
  if (state.count >= max) return { ...state, updatedAt: now };

  // Защита от перевода часов назад: не даём отрицательный прогресс.
  const elapsed = Math.max(0, now - state.updatedAt);
  const step = regenMs(cfg);
  const gained = Math.floor(elapsed / step);
  if (gained === 0) return state;

  const count = Math.min(max, state.count + gained);
  const updatedAt = count >= max ? now : state.updatedAt + gained * step;
  return { ...state, count, updatedAt };
}

export function canPlay(state: TicketState, now: number): boolean {
  return isUnlimited(state, now) || state.count > 0;
}

/** Списывает билет за ошибку. Возвращает null, если билетов нет. */
export function spendTicket(state: TicketState, now: number, cfg: GameConfig): TicketState | null {
  if (isUnlimited(state, now)) return state;
  const synced = syncTickets(state, now, cfg);
  if (synced.count <= 0) return null;
  const wasFull = synced.count >= cfg.tickets.max;
  return {
    ...synced,
    count: synced.count - 1,
    // Если билеты были полными, таймер восстановления стартует с момента траты.
    updatedAt: wasFull ? now : synced.updatedAt,
  };
}

export function addTickets(state: TicketState, amount: number, now: number, cfg: GameConfig): TicketState {
  const synced = syncTickets(state, now, cfg);
  return { ...synced, count: synced.count + amount };
}

export function addUnlimited(state: TicketState, minutes: number, now: number): TicketState {
  const from = Math.max(now, state.unlimitedUntil);
  return { ...state, unlimitedUntil: from + minutes * MINUTE };
}

/** Сколько миллисекунд до следующего билета (0, если билеты полные). */
export function msToNextTicket(state: TicketState, now: number, cfg: GameConfig): number {
  const synced = syncTickets(state, now, cfg);
  if (synced.count >= cfg.tickets.max) return 0;
  return Math.max(0, synced.updatedAt + regenMs(cfg) - now);
}
