import { PRODUCTS } from '@/core/products';
import { t, tn } from '@/i18n';
import { catalog, config, goBack, returnTo, showToast } from '@/state/app';
import { showRewarded } from '@/state/ads';
import { giveCoins } from '@/state/economy';
import { buy, isOwned } from '@/state/shop';
import { resumeAfterShop } from '@/state/run';
import { play } from '@/audio/sfx';
import type { Product } from '@/platform/types';
import { Header } from '../components/Header';
import { IconCheck, IconVideo } from '../icons';

export function ShopScreen() {
  const products = catalog.value;
  const fromGame = returnTo.value === 'game';

  const back = () => {
    goBack();
    if (fromGame) resumeAfterShop();
  };

  const freeCoins = async () => {
    if (!(await showRewarded())) return;
    giveCoins(config.coins.perAd);
    play('coin');
    showToast(`+${tn('unit.coins', config.coins.perAd)}`, 'good');
  };

  return (
    <div class="screen screen--shop">
      <Header title={t('shop.title')} onBack={back} />
      <main class="shop">
        <button class="shop-free" data-testid="free-coins" onClick={() => void freeCoins()}>
          <IconVideo size={22} />
          <span>{t('shop.freeCoins', { n: config.coins.perAd })}</span>
          <span class="shop-free__price">{t('shop.free')}</span>
        </button>

        {products.length === 0 ? (
          <p class="notice">{t('shop.unavailable')}</p>
        ) : (
          <ul class="shop__list">
            {PRODUCTS.map((def) => {
              const product = products.find((p) => p.id === def.id);
              if (!product) return null;
              const owned = isOwned(def.id);
              if (owned && def.id === 'starter_pack') return null;
              return (
                <li key={def.id}>
                  <button
                    class={`product${def.featured ? ' product--featured' : ''}`}
                    disabled={owned}
                    data-testid={`buy-${def.id}`}
                    onClick={() => void buy(def.id)}
                  >
                    <span class="product__info">
                      <span class="product__name">{t(`product.${def.id}`)}</span>
                      <span class="product__desc">{t(`product.${def.id}.desc`)}</span>
                    </span>
                    <span class="product__price">{owned ? <OwnedMark /> : <Price product={product} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

/** Цена и иконка валюты — строго из данных площадки. */
function Price({ product }: { product: Product }) {
  return (
    <>
      {product.currencyIcon ? (
        <>
          {product.priceValue}
          <img class="product__currency" src={product.currencyIcon} alt={product.currencyCode} />
        </>
      ) : (
        product.price
      )}
    </>
  );
}

function OwnedMark() {
  return (
    <>
      <IconCheck size={18} />
      {t('shop.owned')}
    </>
  );
}
