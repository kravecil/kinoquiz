import { loadFilms } from '@/content';
import { resolveLang, setLanguage, t } from '@/i18n';
import { createPlatform } from '@/platform';
import { setPlatformPaused, setSoundEnabled } from '@/audio/sfx';
import { films, navigate, platform, save, setPlatform, showToast, startClock } from './app';
import { claimDailyBonus } from './economy';
import { installSaveOnHide, loadSave, updateSave } from './persistence';
import { loadCatalog, processPendingPurchases } from './shop';
import { refreshAuth } from './leaderboard';
import { onPlatformPause } from './run';

/** Порядок запуска: площадка → сохранение → язык и контент → покупки → готово. */
export async function boot(): Promise<void> {
  const p = createPlatform();
  setPlatform(p);
  await p.init();
  p.onPause((paused) => {
    setPlatformPaused(paused);
    onPlatformPause(paused);
  });

  const data = await loadSave();
  setSoundEnabled(data.settings.sound);
  installSaveOnHide();
  startClock();
  refreshAuth();

  await applyLanguage(data.settings.lang ?? resolveLang(p.lang()));

  await loadCatalog();
  await processPendingPurchases();

  navigate('menu');
  p.gameReady();

  const bonus = claimDailyBonus();
  if (bonus > 0) setTimeout(() => showToast(t('menu.daily', { n: bonus }), 'good'), 600);
}

/** Смена языка: словарь + контент на этом языке. */
export async function applyLanguage(code: string): Promise<void> {
  await setLanguage(code);
  films.value = await loadFilms(code);
}

/** Выбор языка в настройках (null — как на площадке). */
export async function chooseLanguage(code: string | null): Promise<void> {
  updateSave((d) => {
    d.settings.lang = code;
  });
  await applyLanguage(code ?? resolveLang(platform().lang()));
}

export function toggleSound(): void {
  const next = !save.value?.settings.sound;
  setSoundEnabled(next);
  updateSave((d) => {
    d.settings.sound = next;
  });
}
