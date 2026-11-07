import type { JSX } from 'preact';
import type { HintType, QuizQuestion } from '@/core/types';
import type { RunSnapshot } from '@/core/quiz/marathon';
import { streakMultiplier } from '@/core/scoring';
import { countryName, formatNumber, t, tn } from '@/i18n';
import { config, films, modal, save } from '@/state/app';
import { answer, canUseHint, proceed, runState, useHint } from '@/state/run';
import { ticketView } from '@/state/economy';
import { Header } from '../components/Header';
import {
  IconCalendar,
  IconCheck,
  IconClose,
  IconCross,
  IconHalf,
  IconMegaphone,
  IconShield,
  IconSkip,
  IconTag,
  IconToken,
} from '../icons';

const HINTS: Array<{ type: HintType; Icon: (p: { size?: number }) => JSX.Element }> = [
  { type: 'fifty', Icon: IconHalf },
  { type: 'year', Icon: IconCalendar },
  { type: 'genre', Icon: IconTag },
  { type: 'director', Icon: IconMegaphone },
  { type: 'shield', Icon: IconShield },
  { type: 'skip', Icon: IconSkip },
];

export function GameScreen() {
  const run = runState.value;
  if (!run?.question) return null;
  const q = run.question;

  return (
    <div class="screen screen--game">
      <Header
        compactWallet
        left={
          <button class="icon-btn" aria-label={t('game.exit')} onClick={() => (modal.value = { kind: 'exitRun' })}>
            <IconClose />
          </button>
        }
      />

      <div class="game">
        <RunStatus run={run} />

        <section class="projection" key={q.key}>
          <div class="projection__beam" aria-hidden="true" />
          <div class="screen-panel">
            <Difficulty value={q.difficulty} />
            <p class="screen-panel__text" data-testid="description">
              {q.text}
            </p>
          </div>
          <Reveals run={run} question={q} />
        </section>

        <ul class="options" key={`${q.key}-opts`}>
          {q.options.map((id) => (
            <li key={id}>
              <OptionButton id={id} run={run} question={q} />
            </li>
          ))}
        </ul>

        {run.phase === 'reveal' ? <Feedback run={run} question={q} /> : <HintBar />}
      </div>
    </div>
  );
}

function RunStatus({ run }: { run: RunSnapshot }) {
  const mult = streakMultiplier(Math.max(1, run.streak + 1), config);
  return (
    <div class="run-status">
      <span class="run-status__q">{t('game.question', { n: run.number })}</span>
      <span class="run-status__score" data-testid="score">
        {formatNumber(run.score)}
      </span>
      <span class={`run-status__streak${run.streak >= 2 ? ' is-hot' : ''}`}>
        {t('game.streak', { m: mult.toFixed(1) })}
      </span>
    </div>
  );
}

/** Четыре лампочки: сколько из них горит — такая сложность. */
function Difficulty({ value }: { value: number }) {
  return (
    <div class="difficulty" aria-label={`${value}/4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} class={`difficulty__bulb${i <= value ? ' is-on' : ''}`} />
      ))}
    </div>
  );
}

function Reveals({ run, question }: { run: RunSnapshot; question: QuizQuestion }) {
  const used = run.hintsUsed;
  const film = question.film;
  const items: string[] = [];
  if (used.includes('year')) items.push(t('hint.reveal.year', { year: film.year }));
  if (used.includes('genre')) {
    items.push(
      t('hint.reveal.genre', {
        genres: film.genres.slice(0, 2).map((g) => t(`genre.${g}`)).join(', '),
        countries: film.countries.map(countryName).join(', '),
      }),
    );
  }
  if (used.includes('director')) items.push(t('hint.reveal.director', { name: film.director }));
  if (run.shieldActive) items.push(t('hint.shield'));
  if (items.length === 0) return null;
  return (
    <ul class="reveals">
      {items.map((text) => (
        <li key={text} class="reveals__chip">
          {text}
        </li>
      ))}
    </ul>
  );
}

function OptionButton({ id, run, question }: { id: string; run: RunSnapshot; question: QuizQuestion }) {
  const film = films.value.find((f) => f.id === id);
  const removed = run.removedOptions.includes(id);
  const wrongPick = run.wrongPicks.includes(id);
  const revealing = run.phase === 'reveal';
  const isCorrect = id === question.film.id;

  let state = '';
  if (removed) state = 'is-removed';
  else if (revealing && isCorrect) state = 'is-correct';
  else if (wrongPick) state = 'is-wrong';
  else if (revealing) state = 'is-dim';

  return (
    <button
      class={`option ${state}`}
      disabled={removed || wrongPick || revealing}
      data-testid="option"
      data-correct={import.meta.env.DEV && isCorrect ? 'true' : undefined}
      onClick={() => answer(id)}
    >
      <span class="option__title">{film?.title ?? id}</span>
      {state === 'is-correct' && <IconCheck size={22} />}
      {state === 'is-wrong' && <IconCross size={22} />}
    </button>
  );
}

function HintBar() {
  const s = save.value;
  if (!s) return null;
  return (
    <div class="hints" role="toolbar" aria-label="hints">
      {HINTS.map(({ type, Icon }) => {
        const owned = s.hints[type];
        const cost = config.hints.cost[type];
        const enabled = canUseHint(type);
        return (
          <button
            key={type}
            class="hint"
            disabled={!enabled}
            title={t(`hint.${type}.desc`)}
            data-testid={`hint-${type}`}
            onClick={() => useHint(type)}
          >
            <span class="hint__token">
              <Icon size={22} />
            </span>
            <span class="hint__label">{t(`hint.${type}`)}</span>
            <span class={`hint__badge${owned > 0 ? ' is-owned' : ''}`}>
              {owned > 0 ? `×${owned}` : (
                <>
                  <IconToken size={12} />
                  {cost}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ run, question }: { run: RunSnapshot; question: QuizQuestion }) {
  const res = run.lastResult;
  if (!res) return null;
  const correct = res.kind === 'correct';
  return (
    <div class={`feedback ${correct ? 'feedback--good' : 'feedback--bad'}`} role="status">
      <div class="feedback__text">
        <strong class="feedback__verdict">{correct ? t('game.correct') : t('game.wrong')}</strong>
        {res.kind === 'correct' ? (
          <span class="feedback__reward">
            <span>+{tn('unit.points', res.points)}</span>
            <span class="feedback__coins">
              <IconToken size={16} />+{res.coins}
            </span>
          </span>
        ) : (
          <span class="feedback__detail">
            {t('game.wasFilm', { title: question.film.title, year: question.film.year })}
            {ticketView.value.unlimitedMs === 0 && <em class="feedback__loss">{t('game.ticketLost')}</em>}
          </span>
        )}
      </div>
      <button class="ticket-btn" data-testid="next" onClick={() => proceed()} autoFocus>
        {t('game.next')}
      </button>
    </div>
  );
}
