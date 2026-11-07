import type { IPlatform, LeaderboardData, LeaderboardEntry, Product, Purchase } from '../types';
import { showMockDialog } from './mockDialog';

/**
 * Заглушка площадки для разработки в обычном браузере.
 * Эмулирует рекламу, покупки и рейтинг, сохраняет данные в localStorage.
 *
 * Параметры URL для проверки сценариев:
 *   ?lang=en      — язык площадки
 *   ?auth=0       — игрок не авторизован
 *   ?ads=fail     — рекламу не досматривают
 *   ?fast=1       — реклама и покупки без задержек и диалогов (для автотестов)
 */

const CLOUD_KEY = 'kinoquiz.cloud';
const PURCHASES_KEY = 'kinoquiz.mock.purchases';
const LB_KEY = 'kinoquiz.mock.leaderboard';

const MOCK_PRICES: Record<string, number> = {
  starter_pack: 29,
  tickets_5: 15,
  unlimited_1h: 19,
  unlimited_24h: 59,
  coins_300: 19,
  coins_1000: 49,
  coins_3000: 119,
  no_ads: 99,
};

const BOTS = [
  'Синефил', 'Kubrick_fan', 'Олег Попкорнов', 'Marty McFly', 'Тарковская', 'NeoMatrix',
  'Киноман 3000', 'Ripley', 'Алиса', 'Dude', 'Шурик', 'Amélie',
];

export class LocalPlatform implements IPlatform {
  readonly id = 'local' as const;
  private readonly params = new URLSearchParams(location.search);
  private authorized = this.params.get('auth') !== '0';
  private readonly fast = this.params.get('fast') === '1';
  private pauseListeners: Array<(paused: boolean) => void> = [];

  async init(): Promise<void> {
    document.addEventListener('visibilitychange', () => {
      this.emitPause(document.hidden);
    });
  }

  gameReady(): void {
    console.info('[platform] game ready');
  }

  gameplayStart(): void {
    console.info('[platform] gameplay start');
  }

  gameplayStop(): void {
    console.info('[platform] gameplay stop');
  }

  lang(): string {
    return this.params.get('lang') ?? navigator.language.slice(0, 2);
  }

  serverTime(): number {
    return Date.now();
  }

  onPause(listener: (paused: boolean) => void): void {
    this.pauseListeners.push(listener);
  }

  private emitPause(paused: boolean): void {
    for (const l of this.pauseListeners) l(paused);
  }

  ads = {
    interstitial: async (): Promise<void> => {
      if (this.fast) return;
      this.emitPause(true);
      await showMockDialog({ title: 'Реклама', text: 'Полноэкранная реклама (заглушка)', autoCloseMs: 1500 });
      this.emitPause(false);
    },
    rewarded: async (): Promise<boolean> => {
      if (this.params.get('ads') === 'fail') return false;
      if (this.fast) return true;
      this.emitPause(true);
      const choice = await showMockDialog({
        title: 'Реклама за награду',
        text: 'Видео (заглушка). Досмотреть?',
        buttons: [
          { id: 'ok', label: 'Досмотреть' },
          { id: 'close', label: 'Закрыть' },
        ],
      });
      this.emitPause(false);
      return choice === 'ok';
    },
  };

  payments = {
    available: async (): Promise<boolean> => true,
    catalog: async (): Promise<Product[]> =>
      Object.entries(MOCK_PRICES).map(([id, value]) => ({
        id,
        title: id,
        description: '',
        price: `${value} YAN`,
        priceValue: String(value),
        currencyCode: 'YAN',
        currencyIcon: null,
      })),
    purchase: async (productId: string): Promise<Purchase | null> => {
      if (!this.fast) {
        const choice = await showMockDialog({
          title: 'Покупка (заглушка)',
          text: `${productId} — ${MOCK_PRICES[productId] ?? '?'} YAN`,
          buttons: [
            { id: 'buy', label: 'Купить' },
            { id: 'cancel', label: 'Отмена' },
          ],
        });
        if (choice !== 'buy') return null;
      }
      const purchase = { productId, token: `mock-${productId}-${Date.now()}` };
      this.writePurchases([...this.readPurchases(), purchase]);
      return purchase;
    },
    purchases: async (): Promise<Purchase[]> => this.readPurchases(),
    consume: async (token: string): Promise<void> => {
      this.writePurchases(this.readPurchases().filter((p) => p.token !== token));
    },
  };

  leaderboard = {
    submit: async (score: number): Promise<void> => {
      if (!this.authorized) throw new Error('not authorized');
      const best = Number(localStorage.getItem(LB_KEY) ?? 0);
      if (score > best) localStorage.setItem(LB_KEY, String(score));
    },
    load: async (): Promise<LeaderboardData> => {
      const bots: LeaderboardEntry[] = BOTS.map((name, i) => ({
        rank: 0,
        name,
        score: Math.round((9000 - i * 640 + ((i * 37) % 11) * 13) / 5) * 5,
        avatar: null,
        isPlayer: false,
      }));
      const playerScore = Number(localStorage.getItem(LB_KEY) ?? 0);
      const all = [...bots];
      if (this.authorized && playerScore > 0) {
        all.push({ rank: 0, name: 'Вы', score: playerScore, avatar: null, isPlayer: true });
      }
      all.sort((a, b) => b.score - a.score).forEach((e, i) => (e.rank = i + 1));
      const player = all.find((e) => e.isPlayer) ?? null;
      return { entries: all.slice(0, 10), player };
    },
  };

  auth = {
    isAuthorized: (): boolean => this.authorized,
    login: async (): Promise<boolean> => {
      if (this.fast) {
        this.authorized = true;
        return true;
      }
      const choice = await showMockDialog({
        title: 'Вход (заглушка)',
        text: 'Авторизоваться в Яндексе?',
        buttons: [
          { id: 'yes', label: 'Войти' },
          { id: 'no', label: 'Отмена' },
        ],
      });
      this.authorized = choice === 'yes';
      return this.authorized;
    },
  };

  storage = {
    load: async (): Promise<unknown> => {
      try {
        const raw = localStorage.getItem(CLOUD_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save: async (data: unknown): Promise<void> => {
      try {
        localStorage.setItem(CLOUD_KEY, JSON.stringify(data));
      } catch {
        /* хранилище недоступно — игра продолжает работать */
      }
    },
  };

  private readPurchases(): Purchase[] {
    try {
      return JSON.parse(localStorage.getItem(PURCHASES_KEY) ?? '[]') as Purchase[];
    } catch {
      return [];
    }
  }

  private writePurchases(list: Purchase[]): void {
    try {
      localStorage.setItem(PURCHASES_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
}
