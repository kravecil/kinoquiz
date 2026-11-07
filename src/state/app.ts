import { signal } from '@preact/signals';
import { defaultConfig, type GameConfig } from '@/core/config';
import type { SaveData } from '@/core/save';
import type { Film } from '@/core/types';
import type { IPlatform } from '@/platform';
import type { Product } from '@/platform/types';

/**
 * Глобальное состояние приложения на сигналах Preact.
 * Компоненты читают сигналы напрямую и перерисовываются только при их изменении.
 */

export type Screen = 'loading' | 'menu' | 'game' | 'result' | 'shop' | 'leaderboard' | 'settings';

export type Modal =
  | { kind: 'noTickets' }
  | { kind: 'revive' }
  | { kind: 'exitRun' }
  | null;

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export const config: GameConfig = defaultConfig;

let platformRef: IPlatform | null = null;

export function setPlatform(p: IPlatform): void {
  platformRef = p;
}

export function platform(): IPlatform {
  if (!platformRef) throw new Error('Площадка не инициализирована');
  return platformRef;
}

export const screen = signal<Screen>('loading');
/** Куда вернуться из кассы/рейтинга/настроек. */
export const returnTo = signal<Screen>('menu');
export const modal = signal<Modal>(null);
export const toasts = signal<Toast[]>([]);

/** Сохранение игрока. Менять только через updateSave (state/persistence). */
export const save = signal<SaveData | null>(null);
export const films = signal<Film[]>([]);
export const catalog = signal<Product[]>([]);

/** Текущее время площадки, тикает раз в секунду (для таймеров билетов). */
export const clock = signal(Date.now());

export function navigate(to: Screen, options: { returnTo?: Screen } = {}): void {
  if (options.returnTo) returnTo.value = options.returnTo;
  screen.value = to;
}

export function goBack(): void {
  screen.value = returnTo.value;
  returnTo.value = 'menu';
}

let toastId = 0;

export function showToast(text: string, tone: Toast['tone'] = 'info'): void {
  const toast = { id: ++toastId, text, tone };
  toasts.value = [...toasts.value, toast];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== toast.id);
  }, 2600);
}

export function now(): number {
  return platform().serverTime();
}

export function startClock(): void {
  clock.value = now();
  setInterval(() => {
    clock.value = now();
  }, 1000);
}
