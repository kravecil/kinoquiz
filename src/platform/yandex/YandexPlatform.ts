import type { Player, SDK } from 'ysdk';
import type { IPlatform, LeaderboardData, LeaderboardEntry, Product, Purchase } from '../types';

/**
 * Площадка Яндекс Игры поверх официального SDK (/sdk.js).
 * Документация: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
 *
 * Технические имена, которые нужно создать в консоли разработчика:
 *   - лидерборд LEADERBOARD_NAME (числовой, по убыванию);
 *   - товары с id из src/core/products.ts.
 */
export const LEADERBOARD_NAME = 'marathon';

/** Ключ, под которым сохранение лежит в player.setData. */
const SAVE_KEY = 'save';

type SdkLoader = () => Promise<SDK>;

const defaultLoader: SdkLoader = async () => {
  if (typeof YaGames === 'undefined') {
    throw new Error('Yandex Games SDK (/sdk.js) не подключён');
  }
  return YaGames.init();
};

export class YandexPlatform implements IPlatform {
  readonly id = 'yandex' as const;

  private sdk: SDK | null = null;
  private player: Player | null = null;
  private pauseListeners: Array<(paused: boolean) => void> = [];

  /** Игра хочет, чтобы геймплей шёл (сеанс открыт). */
  private gameplayWanted = false;
  /** Геймплей приостановлен рекламой, паузой площадки или скрытой вкладкой. */
  private suspendReasons = new Set<'ad' | 'platform' | 'hidden'>();
  /** Что последним сообщили площадке, чтобы не дублировать вызовы. */
  private gameplayReported = false;

  constructor(private readonly loadSdk: SdkLoader = defaultLoader) {}

  private get ysdk(): SDK {
    if (!this.sdk) throw new Error('SDK не инициализирован');
    return this.sdk;
  }

  async init(): Promise<void> {
    this.sdk = await this.loadSdk();

    // Площадка ставит игру на паузу (например, стартовая реклама): глушим звук и останавливаем игру.
    this.sdk.on('game_api_pause', () => this.suspend('platform', true));
    this.sdk.on('game_api_resume', () => this.suspend('platform', false));

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.suspend('hidden', document.hidden));
    }

    await this.loadPlayer();
  }

  private async loadPlayer(): Promise<void> {
    try {
      this.player = await this.ysdk.getPlayer();
    } catch (err) {
      console.warn('[yandex] getPlayer', err);
      this.player = null;
    }
  }

  gameReady(): void {
    this.ysdk.features.LoadingAPI?.ready();
  }

  gameplayStart(): void {
    this.gameplayWanted = true;
    this.reportGameplay();
  }

  gameplayStop(): void {
    this.gameplayWanted = false;
    this.reportGameplay();
  }

  private suspend(reason: 'ad' | 'platform' | 'hidden', on: boolean): void {
    const wasPaused = this.suspendReasons.size > 0;
    if (on) this.suspendReasons.add(reason);
    else this.suspendReasons.delete(reason);
    const isPaused = this.suspendReasons.size > 0;
    if (wasPaused !== isPaused) {
      for (const l of this.pauseListeners) l(isPaused);
    }
    this.reportGameplay();
  }

  /** Сообщает площадке start/stop только при реальной смене состояния. */
  private reportGameplay(): void {
    const active = this.gameplayWanted && this.suspendReasons.size === 0;
    if (active === this.gameplayReported) return;
    this.gameplayReported = active;
    const api = this.sdk?.features.GameplayAPI;
    if (active) api?.start();
    else api?.stop();
  }

  lang(): string {
    return this.ysdk.environment.i18n.lang;
  }

  serverTime(): number {
    try {
      return this.ysdk.serverTime();
    } catch {
      return Date.now();
    }
  }

  onPause(listener: (paused: boolean) => void): void {
    this.pauseListeners.push(listener);
  }

  ads = {
    interstitial: (): Promise<void> =>
      new Promise<void>((resolve) => {
        let opened = false;
        const finish = () => {
          if (opened) this.suspend('ad', false);
          resolve();
        };
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              opened = true;
              this.suspend('ad', true);
            },
            onClose: () => finish(),
            onError: (err) => {
              console.warn('[yandex] fullscreen', err);
              finish();
            },
            onOffline: () => finish(),
          },
        });
      }),

    rewarded: (): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        let rewarded = false;
        let opened = false;
        const finish = () => {
          if (opened) this.suspend('ad', false);
          resolve(rewarded);
        };
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              opened = true;
              this.suspend('ad', true);
            },
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(),
            onError: (err) => {
              console.warn('[yandex] rewarded', err);
              finish();
            },
          },
        });
      }),
  };

  payments = {
    available: async (): Promise<boolean> => {
      try {
        return await this.ysdk.isAvailableMethod('payments.purchase');
      } catch {
        return false;
      }
    },

    catalog: async (): Promise<Product[]> => {
      const items = await this.ysdk.payments.getCatalog();
      return items.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        priceValue: p.priceValue,
        currencyCode: p.priceCurrencyCode,
        currencyIcon: safeCall(() => p.getPriceCurrencyImage('svg')),
      }));
    },

    purchase: async (productId: string): Promise<Purchase | null> => {
      try {
        const p = await this.ysdk.payments.purchase({ id: productId });
        return { productId: p.productID, token: p.purchaseToken };
      } catch (err) {
        // Отмена окна оплаты и ошибки оплаты SDK возвращает одинаково — как отказ.
        console.info('[yandex] purchase cancelled or failed', err);
        return null;
      }
    },

    purchases: async (): Promise<Purchase[]> => {
      const list = await this.ysdk.payments.getPurchases();
      return list.map((p) => ({ productId: p.productID, token: p.purchaseToken }));
    },

    consume: async (token: string): Promise<void> => {
      await this.ysdk.payments.consumePurchase(token);
    },
  };

  leaderboard = {
    submit: async (score: number): Promise<void> => {
      const can = await this.ysdk.isAvailableMethod('leaderboards.setScore');
      if (!can) return;
      await this.ysdk.leaderboards.setScore(LEADERBOARD_NAME, Math.round(score));
    },

    load: async (): Promise<LeaderboardData> => {
      const authorized = this.auth.isAuthorized();
      const res = await this.ysdk.leaderboards.getEntries(LEADERBOARD_NAME, {
        quantityTop: 10,
        includeUser: authorized,
        quantityAround: 1,
      });
      const myId = authorized ? safeCall(() => this.player?.getUniqueID() ?? null) : null;

      const mapped: LeaderboardEntry[] = res.entries.map((e) => ({
        rank: e.rank,
        name: e.player.publicName ?? '',
        score: e.score,
        // Если игрок скрыл аватар, SDK вернёт пустую строку или заглушку — пустую отбрасываем.
        avatar: safeCall(() => e.player.getAvatarSrc('small')) || null,
        isPlayer: !!myId && e.player.uniqueID === myId,
      }));

      return {
        entries: mapped.filter((e) => e.rank <= 10),
        player: mapped.find((e) => e.isPlayer) ?? null,
      };
    },
  };

  auth = {
    isAuthorized: (): boolean => {
      try {
        return this.player?.isAuthorized() ?? false;
      } catch {
        return false;
      }
    },
    login: async (): Promise<boolean> => {
      try {
        await this.ysdk.auth.openAuthDialog();
      } catch {
        return false;
      }
      // После входа объект игрока нужно получить заново.
      await this.loadPlayer();
      return this.auth.isAuthorized();
    },
  };

  storage = {
    load: async (): Promise<unknown> => {
      if (!this.player) return null;
      const data = await this.player.getData([SAVE_KEY]);
      return data[SAVE_KEY] ?? null;
    },
    save: async (data: unknown): Promise<void> => {
      if (!this.player) return;
      await this.player.setData({ [SAVE_KEY]: data }, true);
    },
  };
}

function safeCall<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
