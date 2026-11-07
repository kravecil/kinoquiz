import { addUnlimited, addTickets } from '@/core/tickets';
import { findProduct, type ProductDef } from '@/core/products';
import type { HintType } from '@/core/types';
import { t } from '@/i18n';
import { play } from '@/audio/sfx';
import { catalog, config, now, platform, save, showToast } from './app';
import { flushSave, updateSave } from './persistence';

/**
 * Покупки по схеме, которую требует площадка:
 *   purchase → выдать → сохранить → consume.
 * При запуске проверяем необработанные покупки (если игра закрылась посередине).
 * Метка `${productId}:${token}` в grantedPurchases защищает от двойной выдачи.
 */

function grantKey(productId: string, token: string): string {
  return `${productId}:${token}`;
}

function applyGrant(def: ProductDef, token: string): void {
  updateSave((d) => {
    const g = def.grant;
    if (g.coins) d.coins += g.coins;
    if (g.tickets) d.tickets = addTickets(d.tickets, g.tickets, now(), config);
    if (g.unlimitedMinutes) d.tickets = addUnlimited(d.tickets, g.unlimitedMinutes, now());
    if (g.hints) {
      for (const [type, n] of Object.entries(g.hints) as Array<[HintType, number]>) d.hints[type] += n;
    }
    if (g.noAds) d.noAds = true;
    d.grantedPurchases = [...d.grantedPurchases, grantKey(def.id, token)].slice(-200);
  });
}

export async function loadCatalog(): Promise<void> {
  try {
    if (!(await platform().payments.available())) return;
    catalog.value = await platform().payments.catalog();
  } catch (err) {
    console.warn('[shop] каталог недоступен', err);
  }
}

/** Выдаёт всё, что куплено, но не выдано или не израсходовано. */
export async function processPendingPurchases(): Promise<void> {
  let purchases;
  try {
    purchases = await platform().payments.purchases();
  } catch {
    return;
  }
  for (const p of purchases) {
    const def = findProduct(p.productId);
    if (!def) continue;
    const already = save.value?.grantedPurchases.includes(grantKey(def.id, p.token));
    if (def.permanent) {
      // Разовые покупки не расходуются: просто восстанавливаем эффект.
      if (def.grant.noAds && !save.value?.noAds) updateSave((d) => void (d.noAds = true));
      continue;
    }
    if (!already) applyGrant(def, p.token);
    await flushSave({ force: true });
    try {
      await platform().payments.consume(p.token);
    } catch (err) {
      console.warn('[shop] consume', err);
    }
  }
}

export async function buy(productId: string): Promise<boolean> {
  const def = findProduct(productId);
  if (!def) return false;
  let purchase;
  try {
    purchase = await platform().payments.purchase(productId);
  } catch (err) {
    console.warn('[shop] purchase', err);
    showToast(t('shop.unavailable'), 'bad');
    return false;
  }
  if (!purchase) return false;

  applyGrant(def, purchase.token);
  await flushSave({ force: true });
  if (!def.permanent) {
    try {
      await platform().payments.consume(purchase.token);
    } catch (err) {
      console.warn('[shop] consume', err);
    }
  }
  play('coin');
  showToast(t('shop.success'), 'good');
  return true;
}

export function isOwned(productId: string): boolean {
  const def = findProduct(productId);
  if (!def) return false;
  if (def.grant.noAds) return !!save.value?.noAds;
  // Стартовый набор продаётся один раз.
  if (productId === 'starter_pack') {
    return !!save.value?.grantedPurchases.some((k) => k.startsWith('starter_pack:'));
  }
  return false;
}
