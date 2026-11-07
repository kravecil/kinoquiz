/**
 * Абстракция игровой площадки. Игра работает только через этот интерфейс,
 * поэтому её можно запускать локально (LocalPlatform) и переносить на другие
 * площадки, реализовав этот же интерфейс.
 */

export interface Product {
  id: string;
  title: string;
  description: string;
  /** Строка цены как её отдаёт площадка, например «29 YAN». */
  price: string;
  priceValue: string;
  currencyCode: string;
  /** Иконка валюты площадки (по требованиям Яндекса берётся из SDK). */
  currencyIcon: string | null;
}

export interface Purchase {
  productId: string;
  token: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  avatar: string | null;
  isPlayer: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  player: LeaderboardEntry | null;
}

export interface IPlatform {
  readonly id: 'local' | 'yandex';

  init(): Promise<void>;
  /** Игра загружена и готова (LoadingAPI.ready). */
  gameReady(): void;
  /** Начало и конец активного геймплея (GameplayAPI). */
  gameplayStart(): void;
  gameplayStop(): void;

  /** Язык, который сообщает площадка (код ISO 639-1). */
  lang(): string;
  /** Время, устойчивое к переводу часов на устройстве. */
  serverTime(): number;

  /** Подписка на паузу от площадки (реклама, сворачивание вкладки). */
  onPause(listener: (paused: boolean) => void): void;

  ads: {
    interstitial(): Promise<void>;
    /** true — игрок досмотрел ролик и заслужил награду. */
    rewarded(): Promise<boolean>;
  };

  payments: {
    available(): Promise<boolean>;
    catalog(): Promise<Product[]>;
    /** null — игрок отменил покупку. */
    purchase(productId: string): Promise<Purchase | null>;
    /** Все покупки игрока: необработанные расходуемые и разовые. */
    purchases(): Promise<Purchase[]>;
    consume(token: string): Promise<void>;
  };

  leaderboard: {
    submit(score: number): Promise<void>;
    load(): Promise<LeaderboardData>;
  };

  auth: {
    isAuthorized(): boolean;
    login(): Promise<boolean>;
  };

  storage: {
    load(): Promise<unknown>;
    save(data: unknown): Promise<void>;
  };
}
