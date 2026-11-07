import { describe, expect, it } from 'vitest';
import { defaultConfig as cfg } from './config';
import { createRng, hashSeed } from './rng';
import { difficultyOf, normalize, pickDecoys, pickQuestion } from './quiz/picker';
import { MarathonRun } from './quiz/marathon';
import { coinsFor, scoreFor, streakMultiplier } from './scoring';
import { addTickets, addUnlimited, msToNextTicket, spendTicket, syncTickets, type TicketState } from './tickets';
import { createSave, migrateSave, newerSave } from './save';
import { makeFilms } from './test-fixtures';

const MIN = 60_000;

describe('rng', () => {
  it('детерминирован при одинаковом seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('shuffle сохраняет элементы', () => {
    const rng = createRng(1);
    expect(rng.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('hashSeed стабилен', () => {
    expect(hashSeed('2026-11-07')).toBe(hashSeed('2026-11-07'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('picker', () => {
  const films = makeFilms(30);

  it('сложность = популярность + уровень описания - 1', () => {
    expect(difficultyOf(films[0]!, 1)).toBe(1);
    expect(difficultyOf(films[2]!, 2)).toBe(4);
  });

  it('даёт 4 уникальных варианта с правильным ответом', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const q = pickQuestion({ films, rng, maxDifficulty: 4, usedInRun: new Set(), seen: new Set() })!;
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.film.id);
    }
  });

  it('уважает потолок сложности', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const q = pickQuestion({ films, rng, maxDifficulty: 2, usedInRun: new Set(), seen: new Set() })!;
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('предпочитает невиденные вопросы', () => {
    const rng = createRng(5);
    const seen = new Set(films.flatMap((f) => [`${f.id}:1`, `${f.id}:2`]).filter((k) => k !== 'f0:1'));
    const q = pickQuestion({ films, rng, maxDifficulty: 4, usedInRun: new Set(), seen })!;
    expect(q.key).toBe('f0:1');
  });

  it('не повторяет фильмы в забеге и возвращает null, когда они кончились', () => {
    const small = makeFilms(5);
    const rng = createRng(9);
    const used = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const q = pickQuestion({ films: small, rng, maxDifficulty: 4, usedInRun: used, seen: new Set() })!;
      expect(used.has(q.film.id)).toBe(false);
      used.add(q.film.id);
    }
    expect(pickQuestion({ films: small, rng, maxDifficulty: 4, usedInRun: used, seen: new Set() })).toBeNull();
  });

  it('не смешивает мультфильмы с игровым кино, если есть выбор', () => {
    const rng = createRng(11);
    const target = films.find((f) => f.genres.includes('animation'))!;
    const decoys = pickDecoys(target, films, rng, 3);
    expect(decoys.every((d) => d.genres.includes('animation'))).toBe(true);
  });

  it('normalize убирает регистр, ё и пунктуацию', () => {
    expect(normalize('Ёлки-палки!')).toBe('елки палки');
  });
});

describe('scoring', () => {
  it('множитель серии растёт и упирается в потолок', () => {
    expect(streakMultiplier(1, cfg)).toBe(1);
    expect(streakMultiplier(3, cfg)).toBeCloseTo(1.2);
    expect(streakMultiplier(100, cfg)).toBe(cfg.score.streakMaxMultiplier);
  });

  it('быстрый ответ даёт больше очков, подсказки — меньше', () => {
    const fast = scoreFor({ difficulty: 2, answerSec: 1, streak: 1, hintsUsed: 0 }, cfg);
    const slow = scoreFor({ difficulty: 2, answerSec: 30, streak: 1, hintsUsed: 0 }, cfg);
    const hinted = scoreFor({ difficulty: 2, answerSec: 30, streak: 1, hintsUsed: 2 }, cfg);
    expect(fast).toBeGreaterThan(slow);
    expect(hinted).toBeLessThan(slow);
    expect(slow).toBe(150);
  });

  it('бонус монет за каждые 5 подряд', () => {
    expect(coinsFor(1, 4, cfg)).toBe(2);
    expect(coinsFor(1, 5, cfg)).toBe(2 + cfg.coins.streakBonus);
  });
});

describe('tickets', () => {
  const start: TicketState = { count: 5, updatedAt: 0, unlimitedUntil: 0 };

  it('тратит билет и запускает восстановление', () => {
    const s = spendTicket(start, 1000, cfg)!;
    expect(s.count).toBe(4);
    expect(s.updatedAt).toBe(1000);
    expect(msToNextTicket(s, 1000, cfg)).toBe(20 * MIN);
  });

  it('восстанавливает билеты со временем, но не выше максимума', () => {
    const s: TicketState = { count: 1, updatedAt: 0, unlimitedUntil: 0 };
    expect(syncTickets(s, 45 * MIN, cfg).count).toBe(3);
    expect(syncTickets(s, 45 * MIN, cfg).updatedAt).toBe(40 * MIN);
    expect(syncTickets(s, 999 * MIN, cfg).count).toBe(5);
  });

  it('перевод часов назад не даёт билетов', () => {
    const s: TicketState = { count: 1, updatedAt: 100 * MIN, unlimitedUntil: 0 };
    expect(syncTickets(s, 0, cfg).count).toBe(1);
  });

  it('без билетов тратить нельзя, в безлимите — можно', () => {
    const empty: TicketState = { count: 0, updatedAt: 0, unlimitedUntil: 0 };
    expect(spendTicket(empty, 1, cfg)).toBeNull();
    const unlimited = addUnlimited(empty, 60, 0);
    expect(spendTicket(unlimited, 30 * MIN, cfg)).toEqual(unlimited);
  });

  it('купленные билеты превышают максимум', () => {
    expect(addTickets(start, 10, 0, cfg).count).toBe(15);
  });
});

describe('MarathonRun', () => {
  const films = makeFilms(40);

  function run(seed = 1) {
    return new MarathonRun(films, createRng(seed), cfg, new Set());
  }

  it('правильный ответ даёт очки и монеты, серия растёт', () => {
    const r = run();
    let snap = r.start(0);
    const first = snap.question!;
    const res = r.answer(first.film.id, 2000);
    expect(res.kind).toBe('correct');
    snap = r.next(2500);
    expect(snap.number).toBe(2);
    r.answer(snap.question!.film.id, 3000);
    const after = r.snapshot();
    expect(after.streak).toBe(2);
    expect(after.score).toBeGreaterThan(0);
    expect(after.coinsEarned).toBeGreaterThan(0);
  });

  it('ошибка сбрасывает серию', () => {
    const r = run();
    const q = r.start(0).question!;
    r.answer(q.film.id, 1000);
    const q2 = r.next(1000).question!;
    const wrongId = q2.options.find((id) => id !== q2.film.id)!;
    const res = r.answer(wrongId, 2000);
    expect(res).toEqual({ kind: 'wrong', picked: wrongId, correctId: q2.film.id });
    expect(r.snapshot().streak).toBe(0);
  });

  it('первые вопросы не сложнее потолка разгона', () => {
    const r = run(4);
    let snap = r.start(0);
    for (let i = 0; i < 5; i++) {
      expect(snap.question!.difficulty).toBeLessThanOrEqual(2);
      r.answer(snap.question!.film.id, i * 1000);
      snap = r.next(i * 1000);
    }
  });

  it('50/50 убирает два неверных варианта', () => {
    const r = run();
    const q = r.start(0).question!;
    const eff = r.useHint('fifty', 0);
    expect(eff.type === 'fifty' && eff.removed.length).toBe(2);
    if (eff.type === 'fifty') expect(eff.removed).not.toContain(q.film.id);
    expect(r.canUseHint('fifty')).toBe(false);
  });

  it('второй шанс спасает от ошибки один раз', () => {
    const r = run();
    const q = r.start(0).question!;
    const wrong = q.options.filter((id) => id !== q.film.id);
    r.useHint('shield', 0);
    expect(r.answer(wrong[0]!, 100).kind).toBe('saved');
    expect(r.snapshot().phase).toBe('question');
    expect(r.answer(wrong[1]!, 200).kind).toBe('wrong');
  });

  it('пропуск меняет вопрос, не увеличивая номер', () => {
    const r = run();
    const first = r.start(0);
    r.useHint('skip', 0);
    const snap = r.snapshot();
    expect(snap.number).toBe(first.number);
    expect(snap.question!.film.id).not.toBe(first.question!.film.id);
  });

  it('продолжение доступно ограниченное число раз', () => {
    const r = run();
    expect(r.canRevive()).toBe(true);
    r.markRevive();
    expect(r.canRevive()).toBe(false);
  });
});

describe('save', () => {
  it('битые данные превращаются в сохранение по умолчанию', () => {
    expect(migrateSave('мусор', 0, cfg)).toEqual(createSave(0, cfg));
    const fixed = migrateSave({ coins: -5, tickets: { count: 'x' } }, 0, cfg);
    expect(fixed.coins).toBe(0);
    expect(fixed.tickets.count).toBe(cfg.tickets.max);
  });

  it('выбирается более свежая копия', () => {
    const a = { ...createSave(0, cfg), savedAt: 10 };
    const b = { ...createSave(0, cfg), savedAt: 20 };
    expect(newerSave(a, b)).toBe(b);
    expect(newerSave(null, a)).toBe(a);
  });
});
