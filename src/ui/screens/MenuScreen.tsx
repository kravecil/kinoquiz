import { formatDuration, formatNumber, t } from '@/i18n';
import { navigate, save } from '@/state/app';
import { ticketView } from '@/state/economy';
import { startRun } from '@/state/run';
import { play } from '@/audio/sfx';
import { Header } from '../components/Header';
import { Marquee } from '../components/Overlays';
import { IconGear, IconKeyboard, IconPlay, IconTicket, IconTrophy } from '../icons';

export function MenuScreen() {
  const best = save.value?.stats.bestScore ?? 0;
  const bestHardcore = save.value?.stats.bestScoreHardcore ?? 0;
  const tv = ticketView.value;

  const ticketLine =
    tv.unlimitedMs > 0
      ? t('tickets.unlimited', { time: formatDuration(tv.unlimitedMs) })
      : tv.nextMs > 0
        ? t('tickets.next', { time: formatDuration(tv.nextMs) })
        : t('tickets.full');

  return (
    <div class="screen screen--menu">
      <Header
        left={
          <button
            class="icon-btn"
            aria-label={t('menu.settings')}
            onClick={() => {
              play('tap');
              navigate('settings', { returnTo: 'menu' });
            }}
          >
            <IconGear />
          </button>
        }
      />

      <main class="menu">
        <Marquee title={t('app.title')} subtitle={t('app.tagline')} />

        {best > 0 && <p class="menu__best">{t('menu.best', { n: formatNumber(best) })}</p>}

        <div class="menu__modes">
          <div class="menu__mode">
            <button class="ticket-btn ticket-btn--hero" data-testid="play" onClick={() => startRun()}>
              <IconPlay size={22} />
              <span>{t('menu.play')}</span>
            </button>
            <p class="menu__tickets">{ticketLine}</p>
          </div>

          <div class="menu__mode">
          <button
            class="ticket-btn ticket-btn--hardcore"
            data-testid="play-hardcore"
            onClick={() => startRun('hardcore')}
          >
            <IconKeyboard size={22} />
            <span>{t('menu.hardcore')}</span>
          </button>
          <p class="menu__hardcore-note">
            {bestHardcore > 0
              ? t('menu.bestHardcore', { n: formatNumber(bestHardcore) })
              : t('menu.hardcore.desc')}
          </p>
          </div>
        </div>

        <nav class="menu__nav">
          <button
            class="brass-btn"
            onClick={() => {
              play('tap');
              navigate('leaderboard', { returnTo: 'menu' });
            }}
          >
            <IconTrophy size={20} />
            {t('menu.leaderboard')}
          </button>
          <button
            class="brass-btn"
            data-testid="open-shop"
            onClick={() => {
              play('tap');
              navigate('shop', { returnTo: 'menu' });
            }}
          >
            <IconTicket size={20} />
            {t('menu.shop')}
          </button>
        </nav>
      </main>
    </div>
  );
}
