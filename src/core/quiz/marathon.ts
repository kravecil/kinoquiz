import type { GameConfig } from '../config';
import type { Rng } from '../rng';
import type { Difficulty, Film, HintType, QuizQuestion } from '../types';
import { coinsFor, scoreFor } from '../scoring';
import { pickQuestion } from './picker';

export type RunPhase = 'question' | 'reveal' | 'complete';

export type AnswerResult =
  | { kind: 'correct'; points: number; coins: number; streak: number }
  | { kind: 'saved'; picked: string }
  | { kind: 'wrong'; picked: string; correctId: string };

export type HintEffect =
  | { type: 'fifty'; removed: string[] }
  | { type: 'year' | 'genre' | 'director' }
  | { type: 'skip' }
  | { type: 'shield' };

/** Неизменяемый снимок забега для интерфейса. */
export interface RunSnapshot {
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
  private shieldActive = false;
  private lastResult: AnswerResult | null = null;
  private readonly usedFilms = new Set<string>();
  /** Ключи вопросов, показанных в этом забеге (для сохранения «виденных»). */
  readonly shownKeys: string[] = [];

  constructor(
    private readonly films: readonly Film[],
    private readonly rng: Rng,
    private readonly cfg: GameConfig,
    private readonly seen: ReadonlySet<string>,
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

  answer(optionId: string, now: number): AnswerResult {
    const q = this.requireQuestion();
    if (this.phase !== 'question') throw new Error('Ответ уже принят');
    if (this.removedOptions.includes(optionId) || this.wrongPicks.includes(optionId)) {
      throw new Error('Вариант недоступен');
    }

    let result: AnswerResult;
    if (optionId === q.film.id) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.correct += 1;
      const answerSec = (now - this.questionShownAt) / 1000;
      const points = scoreFor(
        { difficulty: q.difficulty, answerSec, streak: this.streak, hintsUsed: this.scoredHints() },
        this.cfg,
      );
      const coins = coinsFor(q.difficulty, this.streak, this.cfg);
      this.score += points;
      this.coinsEarned += coins;
      result = { kind: 'correct', points, coins, streak: this.streak };
      this.phase = 'reveal';
    } else if (this.shieldActive) {
      // «Второй шанс»: ошибка не засчитывается, вариант гасится, вопрос остаётся.
      this.shieldActive = false;
      this.wrongPicks.push(optionId);
      result = { kind: 'saved', picked: optionId };
    } else {
      this.streak = 0;
      this.wrong += 1;
      this.wrongPicks.push(optionId);
      result = { kind: 'wrong', picked: optionId, correctId: q.film.id };
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

  /** Продолжение после того, как закончились билеты (за рекламу). */
  canRevive(): boolean {
    return this.revivesUsed < this.cfg.marathon.revivesPerRun;
  }

  markRevive(): void {
    this.revivesUsed += 1;
  }

  snapshot(): RunSnapshot {
    return {
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
