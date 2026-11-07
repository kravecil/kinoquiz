import type { HintType } from './types';

/**
 * Что выдаёт каждая покупка. Id совпадают с id товаров в консоли Яндекс Игр.
 * Цена и валюта здесь НЕ хранятся: по требованиям площадки они берутся из SDK.
 */
export interface ProductGrant {
  coins?: number;
  tickets?: number;
  unlimitedMinutes?: number;
  hints?: Partial<Record<HintType, number>>;
  noAds?: boolean;
}

export interface ProductDef {
  id: string;
  /** Разовая (не расходуемая) покупка: восстанавливается через getPurchases. */
  permanent: boolean;
  grant: ProductGrant;
  /** Выделить в магазине. */
  featured?: boolean;
}

export const PRODUCTS: ProductDef[] = [
  {
    id: 'starter_pack',
    permanent: false,
    featured: true,
    grant: { coins: 500, tickets: 5, hints: { fifty: 3, shield: 2 } },
  },
  { id: 'tickets_5', permanent: false, grant: { tickets: 5 } },
  { id: 'unlimited_1h', permanent: false, grant: { unlimitedMinutes: 60 } },
  { id: 'unlimited_24h', permanent: false, grant: { unlimitedMinutes: 24 * 60 } },
  { id: 'coins_300', permanent: false, grant: { coins: 300 } },
  { id: 'coins_1000', permanent: false, grant: { coins: 1000 } },
  { id: 'coins_3000', permanent: false, grant: { coins: 3000 } },
  { id: 'no_ads', permanent: true, grant: { noAds: true } },
];

export function findProduct(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
