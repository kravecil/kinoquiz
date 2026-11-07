import type { GameConfig } from '../config';
import type { Rng } from '../rng';
import type { Difficulty, Film, GameMode, HintType, QuizQuestion } from '../types';
import { coinsFor, scoreFor } from '../scoring';
import { pickQuestion } from './picker';
import { buildTitleIndex, checkTitle, type TitleIndex } from './titleMatch';

export type RunPhase = 'question' | 'reveal' | 'complete';

/**
 * picked — id выбранного (или названного) фильма; null, если в хардкоре ввод
 * не похож ни на один фильм каталога или игрок сдался. typed — что игрок ввёл.
 */
export type AnswerResult =
  | { kind: 'correct'; points: number; coins: number; streak: number; typed?: string }
  | { kind: 'saved'; picked: string | null; typed?: string }
  | { kind: 'wrong'; picked: string | null; correctId: string; typed?: string };

/**
 * Ответ вводом в хардкоре. unclear — ответ не принят и ничего не стоит:
 * пустой ввод или название, которое подходит к нескольким фильмам сразу.
 */
export type TextAnswerResult = AnswerResult | { kind: 'unclear'; reason: 'empty' | 'ambiguous' };

export type HintEffect =
  | { type: 'fifty'; removed: string[] }
  | { type: 'year' | 'genre' | 'director' }
  | { type: 'skip' }
  | { type: 'shield' };

/** Неизменяемый снимок забега для интерфейса. */
export interface RunSnapshot {
  mode: GameMode;
  phase: RunPhase;
  question: QuizQuestion | null;
  /** Номер текущего вопроса, начиная с 1. */
  number: number;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  coinsEarned: number;
  revivesUsed: number;
  hintsUsed: readonly HintType[];
  removedOptions: readonly string[];
  wrongPicks: readonly string[];
  /** Хардкор: неверные попытки, сгоревшие во «второй шанс». */
  savedAttempts: readonly string[];
  shieldActive: boolean;
  lastResult: AnswerResult | null;
}

/**
 * Режим «Марафон»: вопросы идут один за другим, сложность растёт.
 * Класс отвечает только за ход забега и очки; билеты и монеты списывает контроллер.
 */
export class MarathonRun {
  private number = 0;
  private score = 0;
  private streak = 0;
  private bestStreak = 0;
  private correct = 0;
  private wrong = 0;
  private coinsEarned = 0;
  private revivesUsed = 0;
  private phase: RunPhase = 'question';
  private question: QuizQuestion | null = null;
  private questionShownAt = 0;
  private hintsUsed: HintType[] = [];
  private removedOptions: string[] = [];
  private wrongPicks: string[] = [];
  private savedAttempts: string[] = [];
  private shieldActive = false;
  private titleIndex: TitleIndex | null = null;
  private lastResult: AnswerResult | null = null;
  private readonly usedFilms = new Set<string>();
  /** Ключи вопросов, показанных в этом забеге (для сохранения «виденных»). */
  readonly shownKeys: string[] = [];

  constructor(
    private readonly films: readonly Film[],
    private readonly rng: Rng,
    private readonly cfg: GameConfig,
    private readonly seen: ReadonlySet<string>,
    readonly mode: GameMode = 'classic',
  ) {}

  start(now: number): RunSnapshot {
    this.advance(now);
    return this.snapshot();
  }

  maxDifficulty(): Difficulty {
    const nextNumber = this.number + 1;
    const step = this.cfg.marathon.ramp.find((r) => nextNumber <= r.untilQuestion);
    return step?.maxDifficulty ?? 4;
  }

  /** Переход к следующему вопросу после показа результата. */
  next(now: number): RunSnapshot {
    if (this.phase === 'reveal') this.advance(now);
    return this.snapshot();
  }

  /** Ответ выбором варианта (классический режим). */
  answer(optionId: string, now: number): AnswerResult {
    const q = this.requireQuestion();
    if (this.mode !== 'classic') throw new Error('В хардкоре ответ вводится текстом');
    if (this.phase !== 'question') throw new Error('Ответ уже принят');
    if (this.removedOptions.includes(optionId) || this.wrongPicks.includes(optionId)) {
      throw new Error('Вариант недоступен');
    }
    return this.resolve(optionId === q.film.id, optionId, now);
  }

  /** Ответ вводом названия (хардкор): опечатки, «ё/е» и варианты названия прощаются. */
  answerText(input: string, now: number): TextAnswerResult {
    const q = this.requireQuestion();
    if (this.mode !== 'hardcore') throw new Error('Ввод названия — только в хардкоре');
    if (this.phase !== 'question') throw new Error('Ответ уже принят');

    this.titleIndex ??= buildTitleIndex(this.films);
    const verdict = checkTitle(input, q.film.id, this.titleIndex);
    if (verdict.kind === 'empty' || verdict.kind === 'ambiguous') {
      return { kind: 'unclear', reason: verdict.kind };
    }
    const typed = input.trim();
    if (verdict.kind === 'correct') return this.resolve(true, q.film.id, now, typed);
    return this.resolve(false, verdict.matchedId, now, typed);
  }

  /** «Не знаю» (хардкор): засчитывается как ошибка, «второй шанс» не спасает. */
  giveUp(): AnswerResult {
    this.requireQuestion();
    if (this.phase !== 'question') throw new Error('Ответ уже принят');
    this.shieldActive = false;
    return this.resolve(false, null, 0);
  }

  private resolve(isCorrect: boolean, picked: string | null, now: number, typed?: string): AnswerResult {
    const q = this.requireQuestion();
    const hardcore = this.mode === 'hardcore';
    const extra = typed === undefined ? {} : { typed };

    let result: AnswerResult;
    if (isCorrect) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.correct += 1;
      const answerSec = (now - this.questionShownAt) / 1000;
      const points = scoreFor(
        {
          difficulty: q.difficulty,
          answerSec,
          streak: this.streak,
          hintsUsed: this.scoredHints(),
          ...(hardcore && {
            fastAnswerSec: this.cfg.hardcore.fastAnswerSec,
            multiplier: this.cfg.hardcore.scoreMultiplier,
          }),
        },
        this.cfg,
      );
      const coins = coinsFor(q.difficulty, this.streak, this.cfg, hardcore ? this.cfg.hardcore.coinsMultiplier : 1);
      this.score += points;
      this.coinsEarned += coins;
      result = { kind: 'correct', points, coins, streak: this.streak, ...extra };
      this.phase = 'reveal';
    } else if (this.shieldActive) {
      // «Второй шанс»: ошибка не засчитывается, вариант гасится, вопрос остаётся.
      this.shieldActive = false;
      if (picked) this.wrongPicks.push(picked);
      if (typed !== undefined) this.savedAttempts.push(typed);
      result = { kind: 'saved', picked, ...extra };
    } else {
      this.streak = 0;
      this.wrong += 1;
      if (picked) this.wrongPicks.push(picked);
      result = { kind: 'wrong', picked, correctId: q.film.id, ...extra };
      this.phase = 'reveal';
    }
    this.lastResult = result;
    return result;
  }

  /** Можно ли сейчас применить подсказку. */
  canUseHint(type: HintType): boolean {
    if (this.phase !== 'question' || !this.question) return false;
    if (type === 'skip') return true;
    if (this.hintsUsed.includes(type)) return false;
    if (this.mode === 'hardcore') return !this.cfg.hardcore.disabledHints.includes(type);
    if (type === 'fifty') return this.availableWrongOptions().length >= 2;
    if (type === 'shield') return this.availableWrongOptions().length >= 1;
    return true;
  }

  useHint(type: HintType, now: number): HintEffect {
    if (!this.canUseHint(type)) throw new Error(`Подсказка ${type} недоступна`);

    if (type === 'skip') {
      // Пропуск не ломает серию и не тратит билет.
      this.number -= 1;
      this.advance(now);
      return { type: 'skip' };
    }

    this.hintsUsed.push(type);
    if (type === 'fifty') {
      const removed = this.rng.shuffle(this.availableWrongOptions()).slice(0, 2);
      this.removedOptions.push(...removed);
      return { type: 'fifty', removed };
    }
    if (type === 'shield') {
      this.shieldActive = true;
      return { type: 'shield' };
    }
    return { type };
  }

  /** Время на паузе (реклама площадки, скрытая вкладка) не засчитывается во время ответа. */
  addPausedTime(ms: number): void {
    if (this.phase === 'question' && ms > 0) this.questionShownAt += ms;
  }

  /** Продолжение после того, как закончились билеты (за рекламу). */
  canRevive(): boolean {
    return this.revivesUsed < this.cfg.marathon.revivesPerRun;
  }

  markRevive(): void {
    this.revivesUsed += 1;
  }

  snapshot(): RunSnapshot {
    return {
      mode: this.mode,
      phase: this.phase,
      question: this.question,
      number: this.number,
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak,
      correct: this.correct,
      wrong: this.wrong,
      coinsEarned: this.coinsEarned,
      revivesUsed: this.revivesUsed,
      hintsUsed: [...this.hintsUsed],
      removedOptions: [...this.removedOptions],
      wrongPicks: [...this.wrongPicks],
      savedAttempts: [...this.savedAttempts],
      shieldActive: this.shieldActive,
      lastResult: this.lastResult,
    };
  }

  private advance(now: number): void {
    const next = pickQuestion({
      films: this.films,
      rng: this.rng,
      maxDifficulty: this.maxDifficulty(),
      usedInRun: this.usedFilms,
      seen: this.seen,
    });
    this.hintsUsed = [];
    this.removedOptions = [];
    this.wrongPicks = [];
    this.savedAttempts = [];
    this.shieldActive = false;
    this.lastResult = null;

    if (!next) {
      this.question = null;
      this.phase = 'complete';
      return;
    }
    this.number += 1;
    this.question = next;
    this.usedFilms.add(next.film.id);
    this.shownKeys.push(next.key);
    this.questionShownAt = now;
    this.phase = 'question';
  }

  /** Подсказки, которые снижают очки («второй шанс» тоже считается). */
  private scoredHints(): number {
    return this.hintsUsed.length;
  }

  private availableWrongOptions(): string[] {
    const q = this.requireQuestion();
    return q.options.filter(
      (id) => id !== q.film.id && !this.removedOptions.includes(id) && !this.wrongPicks.includes(id),
    );
  }

  private requireQuestion(): QuizQuestion {
    if (!this.question) throw new Error('Нет активного вопроса');
    return this.question;
  }
}
