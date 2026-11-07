import { useEffect } from 'preact/hooks';
import { formatNumber, t } from '@/i18n';
import { goBack } from '@/state/app';
import { authorized, leaderboard, loadLeaderboard, login } from '@/state/leaderboard';
import type { LeaderboardEntry } from '@/platform/types';
import { Header } from '../components/Header';

export function LeaderboardScreen() {
  useEffect(() => {
    void loadLeaderboard();
  }, []);

  const state = leaderboard.value;

  return (
    <div class="screen screen--leaderboard">
      <Header title={t('lb.title')} onBack={goBack} />
      <main class="board">
        <p class="board__subtitle">{t('lb.subtitle')}</p>

        {state.status === 'loading' || state.status === 'idle' ? (
          <p class="notice">{t('common.loading')}</p>
        ) : state.status === 'error' ? (
          <div class="notice">
            <p>{t('lb.error')}</p>
          </div>
        ) : (
          <>
            <ol class="board__list">
              {state.data.entries.map((e) => (
                <Row key={`${e.rank}-${e.name}`} entry={e} />
              ))}
            </ol>
            {state.data.player && !state.data.entries.some((e) => e.isPlayer) && (
              <ol class="board__list board__list--player">
                <Row entry={state.data.player} />
              </ol>
            )}
            {authorized.value && !state.data.player && <p class="notice">{t('lb.notRanked')}</p>}
          </>
        )}

        {!authorized.value && (
          <div class="notice">
            <p>{t('lb.loginPrompt')}</p>
            <button
              class="link-btn"
              onClick={async () => {
                if (await login()) void loadLeaderboard();
              }}
            >
              {t('lb.login')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li class={`board__row${entry.isPlayer ? ' is-player' : ''}${entry.rank <= 3 ? ` is-top is-top-${entry.rank}` : ''}`}>
      <span class="board__rank">{entry.rank}</span>
      {entry.avatar ? (
        <img class="board__avatar" src={entry.avatar} alt="" />
      ) : (
        <span class="board__avatar board__avatar--empty" aria-hidden="true">
          {entry.name.slice(0, 1)}
        </span>
      )}
      <span class="board__name">{entry.isPlayer ? `${entry.name} (${t('lb.you')})` : entry.name}</span>
      <span class="board__score">{formatNumber(entry.score)}</span>
    </li>
  );
}
