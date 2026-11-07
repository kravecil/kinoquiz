import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@/core/config';
import { createRng } from '@/core/rng';
import { MarathonRun } from '@/core/quiz/marathon';
import { buildTitleIndex, checkTitle, titleVariants } from '@/core/quiz/titleMatch';
import { LANGUAGES, resolveLang, setLanguage, t, tn } from '@/i18n';
import { loadFilms } from './index';

describe('контент', () => {
  for (const lang of LANGUAGES) {
    it(`[${lang.code}] все фильмы загружаются, марафон проходится до конца`, async () => {
      const films = await loadFilms(lang.code);
      expect(films.length).toBeGreaterThanOrEqual(200);

      const run = new MarathonRun(films, createRng(123), defaultConfig, new Set());
      let snap = run.start(0);
      let answered = 0;
      while (snap.phase !== 'complete') {
        const q = snap.question!;
        expect(q.options).toHaveLength(4);
        expect(q.text.length).toBeGreaterThan(20);
        run.answer(q.film.id, answered * 1000);
        snap = run.next(answered * 1000);
        answered++;
      }
      expect(answered).toBe(films.length);
    });
  }
});

describe('хардкор на настоящем каталоге', () => {
  for (const lang of LANGUAGES) {
    it(`[${lang.code}] название и каждый alias узнаются как свой фильм`, async () => {
      const films = await loadFilms(lang.code);
      const index = buildTitleIndex(films);
      const problems: string[] = [];
      for (const film of films) {
        for (const { text, derived } of titleVariants(film)) {
          const verdict = checkTitle(text, film.id, index);
          // Общая часть франшизы («Властелин колец») может быть неоднозначной — это нормально.
          const ok = verdict.kind === 'correct' || (derived && verdict.kind !== 'empty');
          if (!ok) problems.push(`${film.id}: «${text}» → ${JSON.stringify(verdict)}`);
        }
      }
      expect(problems).toEqual([]);
    });

    it(`[${lang.code}] марафон в хардкоре проходится вводом названий с опечаткой`, async () => {
      const films = await loadFilms(lang.code);
      const run = new MarathonRun(films, createRng(7), defaultConfig, new Set(), 'hardcore');
      let snap = run.start(0);
      let answered = 0;
      while (snap.phase !== 'complete') {
        const title = snap.question!.film.title.toLowerCase();
        // Опечатка: пропущенная буква в середине длинного названия.
        const mid = Math.floor(title.length / 2);
        const typed = title.length >= 7 ? title.slice(0, mid) + title.slice(mid + 1) : title;
        expect(run.answerText(typed, 0).kind, `${snap.question!.film.id}: ${typed}`).toBe('correct');
        snap = run.next(0);
        answered++;
      }
      expect(answered).toBe(films.length);
    });
  }
});

describe('i18n', () => {
  it('resolveLang подбирает язык', () => {
    expect(resolveLang('ru')).toBe('ru');
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('kk')).toBe('ru');
    expect(resolveLang('tr')).toBe('en');
    expect(resolveLang(null)).toBe('en');
  });

  it('множественное число по правилам языка', async () => {
    await setLanguage('ru');
    expect(tn('unit.tickets', 1)).toBe('1 билет');
    expect(tn('unit.tickets', 3)).toBe('3 билета');
    expect(tn('unit.tickets', 5)).toBe('5 билетов');
    expect(tn('unit.tickets', 21)).toBe('21 билет');
    await setLanguage('en');
    expect(tn('unit.tickets', 1)).toBe('1 ticket');
    expect(tn('unit.tickets', 2)).toBe('2 tickets');
    expect(t('menu.best', { n: 10 })).toBe('Best: 10');
  });
});
