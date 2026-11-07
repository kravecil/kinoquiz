import { formatNumber, t } from '@/i18n';
import { navigate } from '@/state/app';
import { showInterstitial } from '@/state/ads';
import { authorized, login } from '@/state/leaderboard';
import { doubleCoins, lastResult, startRun } from '@/state/run';
import { Header } from '../components/Header';
import { IconToken, IconVideo } from '../icons';

export function ResultScreen() {
  const r = lastResult.value;
  if (!r) return null;

  // Полноэкранная реклама — только в паузе между сеансами, по действию игрока.
  const again = async () => {
    await showInterstitial();
    startRun();
  };
  const toMenu = async () => {
    await showInterstitial();
    navigate('menu');
  };

  return (
    <div class="screen screen--result">
      <Header />
      <main class="result">
        <h1 class="result__title">{t('result.title')}</h1>

        <div class={`result__score${r.isRecord ? ' is-record' : ''}`}>
          <span class="result__score-label">{t('result.score')}</span>
          <span class="result__score-value" data-testid="final-score">
            {formatNumber(r.score)}
          </span>
          {r.isRecord && r.score > 0 && <span class="result__record">{t('result.record')}</span>}
        </div>

        <dl class="result__stats">
          <div>
            <dt>{t('result.correct')}</dt>
            <dd>{r.correct}</dd>
          </div>
          <div>
            <dt>{t('result.bestStreak')}</dt>
            <dd>{r.bestStreak}</dd>
          </div>
          <div>
            <dt>{t('result.coins')}</dt>
            <dd>
              <IconToken size={18} />
              {r.coinsDoubled ? r.coinsEarned * 2 : r.coinsEarned}
            </dd>
          </div>
        </dl>

        {r.coinsEarned > 0 && !r.coinsDoubled && (
          <button class="brass-btn brass-btn--wide" data-testid="double" onClick={() => void doubleCoins()}>
            <IconVideo size={20} />
            {t('result.double')}
          </button>
        )}

        {!authorized.value && r.score > 0 && (
          <div class="notice">
            <p>{t('result.loginPrompt')}</p>
            <button class="link-btn" onClick={() => void login()}>
              {t('result.login')}
            </button>
          </div>
        )}

        <div class="result__actions">
          <button class="ticket-btn ticket-btn--hero" data-testid="again" onClick={() => void again()}>
            {t('result.again')}
          </button>
          <button class="ghost-btn" data-testid="to-menu" onClick={() => void toMenu()}>
            {t('result.menu')}
          </button>
        </div>
      </main>
    </div>
  );
}
