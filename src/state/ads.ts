import { setPlatformPaused } from '@/audio/sfx';
import { config, platform, save } from './app';

/**
 * Реклама. Полноэкранная — только между сеансами, не чаще кулдауна и не для
 * купивших «Без рекламы». Реклама за награду доступна всем и всегда.
 */

let lastInterstitialAt = 0;

export async function showInterstitial(): Promise<void> {
  if (save.value?.noAds) return;
  const t = Date.now();
  if (t - lastInterstitialAt < config.ads.interstitialCooldownSec * 1000) return;
  lastInterstitialAt = t;
  setPlatformPaused(true);
  try {
    await platform().ads.interstitial();
  } catch (err) {
    console.warn('[ads] interstitial', err);
  } finally {
    setPlatformPaused(false);
  }
}

/** true — награду можно выдавать. */
export async function showRewarded(): Promise<boolean> {
  setPlatformPaused(true);
  try {
    return await platform().ads.rewarded();
  } catch (err) {
    console.warn('[ads] rewarded', err);
    return false;
  } finally {
    setPlatformPaused(false);
  }
}
