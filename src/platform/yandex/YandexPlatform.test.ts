import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SDK } from 'ysdk';
import { LEADERBOARD_NAME, YandexPlatform } from './YandexPlatform';

type AdCallbacks = {
  onOpen?: () => void;
  onClose?: (wasShown?: boolean) => void;
  onError?: (e: Error) => void;
  onRewarded?: () => void;
  onOffline?: () => void;
};

/** Подставной SDK: повторяет нужную часть API Яндекс Игр. */
function createFakeSdk() {
  const calls: string[] = [];
  const listeners: Record<string, Array<() => void>> = {};
  const storage: Record<string, unknown> = {};
  let authorized = false;
  let adScript: (cb: AdCallbacks) => void = (cb) => {
    cb.onOpen?.();
    cb.onClose?.(true);
  };
  let rewardedScript: (cb: AdCallbacks) => void = (cb) => {
    cb.onOpen?.();
    cb.onRewarded?.();
    cb.onClose?.();
  };
  let purchaseScript: (id: string) => Promise<{ productID: string; purchaseToken: string }> = async (id) => ({
    productID: id,
    purchaseToken: `tok-${id}`,
  });

  const player = {
    isAuthorized: () => authorized,
    getUniqueID: () => 'me',
    getData: vi.fn(async (keys?: string[]) =>
      Object.fromEntries((keys ?? Object.keys(storage)).filter((k) => k in storage).map((k) => [k, storage[k]])),
    ),
    setData: vi.fn(async (data: Record<string, unknown>) => {
      Object.assign(storage, data);
    }),
  };

  const sdk = {
    on: (name: string, fn: () => void) => {
      (listeners[name] ??= []).push(fn);
      return () => undefined;
    },
    off: () => undefined,
    serverTime: () => 1_700_000_000_000,
    environment: { i18n: { lang: 'tr', tld: 'com.tr' } },
    features: {
      LoadingAPI: { ready: () => calls.push('ready') },
      GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') },
    },
    adv: {
      showFullscreenAdv: ({ callbacks }: { callbacks: AdCallbacks }) => adScript(callbacks),
      showRewardedVideo: ({ callbacks }: { callbacks: AdCallbacks }) => rewardedScript(callbacks),
    },
    isAvailableMethod: async (name: string) => (name.startsWith('leaderboards') ? authorized : true),
    getPlayer: async () => player,
    auth: {
      openAuthDialog: async () => {
        authorized = true;
      },
    },
    payments: {
      getCatalog: async () => [
        {
          id: 'coins_300',
          title: '300',
          description: '',
          imageURI: '',
          price: '19 YAN',
          priceValue: '19',
          priceCurrencyCode: 'YAN',
          getPriceCurrencyImage: (size: string) => `https://yastatic/yan.${size}`,
        },
      ],
      purchase: async ({ id }: { id: string }) => purchaseScript(id),
      getPurchases: async () => [{ productID: 'no_ads', purchaseToken: 'tok-no-ads' }],
      consumePurchase: vi.fn(async () => undefined),
    },
    leaderboards: {
      setScore: vi.fn(async () => undefined),
      getEntries: vi.fn(async () => ({
        leaderboard: {},
        ranges: [],
        userRank: 14,
        entries: [
          entry(1, 'Анна', 9000, 'a'),
          entry(2, '', 8000, 'b'),
          entry(14, 'Я', 1200, 'me'),
        ],
      })),
    },
  };

  function entry(rank: number, name: string, score: number, id: string) {
    return {
      rank,
      score,
      formattedScore: String(score),
      player: {
        publicName: name,
        uniqueID: id,
        lang: 'ru',
        scopePermissions: { avatar: 'allow', public_name: 'allow' },
        getAvatarSrc: () => (id === 'b' ? '' : `https://avatars/${id}`),
        getAvatarSrcSet: () => '',
      },
    };
  }

  return {
    sdk: sdk as unknown as SDK,
    raw: sdk,
    calls,
    storage,
    emit: (name: string) => listeners[name]?.forEach((fn) => fn()),
    setAuthorized: (v: boolean) => (authorized = v),
    setAdScript: (fn: typeof adScript) => (adScript = fn),
    setRewardedScript: (fn: typeof rewardedScript) => (rewardedScript = fn),
    setPurchaseScript: (fn: typeof purchaseScript) => (purchaseScript = fn),
  };
}

describe('YandexPlatform', () => {
  let fake: ReturnType<typeof createFakeSdk>;
  let platform: YandexPlatform;

  beforeEach(async () => {
    fake = createFakeSdk();
    platform = new YandexPlatform(async () => fake.sdk);
    await platform.init();
  });

  it('язык и серверное время берутся из SDK', () => {
    expect(platform.lang()).toBe('tr');
    expect(platform.serverTime()).toBe(1_700_000_000_000);
  });

  it('LoadingAPI.ready вызывается по готовности', () => {
    platform.gameReady();
    expect(fake.calls).toEqual(['ready']);
  });

  it('GameplayAPI не дублирует вызовы start/stop', () => {
    platform.gameplayStart();
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStop();
    expect(fake.calls).toEqual(['start', 'stop']);
  });

  it('во время рекламы геймплей останавливается и возобновляется', async () => {
    platform.gameplayStart();
    const pauses: boolean[] = [];
    platform.onPause((p) => pauses.push(p));
    await platform.ads.interstitial();
    expect(fake.calls).toEqual(['start', 'stop', 'start']);
    expect(pauses).toEqual([true, false]);
  });

  it('реклама вне геймплея не трогает GameplayAPI', async () => {
    await platform.ads.interstitial();
    expect(fake.calls).toEqual([]);
  });

  it('ошибка или слишком частый показ рекламы не ломают игру', async () => {
    fake.setAdScript((cb) => cb.onClose?.(false));
    await expect(platform.ads.interstitial()).resolves.toBeUndefined();
    fake.setAdScript((cb) => cb.onError?.(new Error('no fill')));
    await expect(platform.ads.interstitial()).resolves.toBeUndefined();
  });

  it('награда выдаётся, только если ролик засчитан', async () => {
    expect(await platform.ads.rewarded()).toBe(true);
    fake.setRewardedScript((cb) => {
      cb.onOpen?.();
      cb.onClose?.();
    });
    expect(await platform.ads.rewarded()).toBe(false);
  });

  it('пауза площадки (game_api_pause/resume) останавливает игру и звук', () => {
    platform.gameplayStart();
    const pauses: boolean[] = [];
    platform.onPause((p) => pauses.push(p));
    fake.emit('game_api_pause');
    fake.emit('game_api_resume');
    expect(pauses).toEqual([true, false]);
    expect(fake.calls).toEqual(['start', 'stop', 'start']);
  });

  it('каталог: цена и иконка валюты из SDK', async () => {
    const [p] = await platform.payments.catalog();
    expect(p).toEqual({
      id: 'coins_300',
      title: '300',
      description: '',
      price: '19 YAN',
      priceValue: '19',
      currencyCode: 'YAN',
      currencyIcon: 'https://yastatic/yan.svg',
    });
  });

  it('покупка, отмена, список и consume', async () => {
    expect(await platform.payments.purchase('coins_300')).toEqual({ productId: 'coins_300', token: 'tok-coins_300' });
    fake.setPurchaseScript(async () => {
      throw new Error('cancelled');
    });
    expect(await platform.payments.purchase('coins_300')).toBeNull();
    expect(await platform.payments.purchases()).toEqual([{ productId: 'no_ads', token: 'tok-no-ads' }]);
    await platform.payments.consume('tok-1');
    expect(fake.raw.payments.consumePurchase).toHaveBeenCalledWith('tok-1');
  });

  it('рейтинг: без входа счёт не отправляется', async () => {
    await platform.leaderboard.submit(500);
    expect(fake.raw.leaderboards.setScore).not.toHaveBeenCalled();
  });

  it('вход, отправка счёта и загрузка рейтинга с местом игрока', async () => {
    expect(platform.auth.isAuthorized()).toBe(false);
    expect(await platform.auth.login()).toBe(true);
    await platform.leaderboard.submit(1234.4);
    expect(fake.raw.leaderboards.setScore).toHaveBeenCalledWith(LEADERBOARD_NAME, 1234);

    const data = await platform.leaderboard.load();
    expect(data.entries.map((e) => e.rank)).toEqual([1, 2]);
    expect(data.entries[1]?.avatar).toBeNull();
    expect(data.player).toMatchObject({ rank: 14, isPlayer: true, score: 1200 });
  });

  it('сохранение пишется и читается через player data', async () => {
    expect(await platform.storage.load()).toBeNull();
    await platform.storage.save({ coins: 42 });
    expect(await platform.storage.load()).toEqual({ coins: 42 });
  });
});
