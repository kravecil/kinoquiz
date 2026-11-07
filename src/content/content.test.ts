import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@/core/config';
import { createRng } from '@/core/rng';
import { MarathonRun } from '@/core/quiz/marathon';
import { LANGUAGES, resolveLang, setLanguage, t, tn } from '@/i18n';
import { loadFilms } from './index';

describe('контент', () => {
  for (const lang of LANGUAGES) {
    it(`[${lang.code}] все фильмы загружаются, марафон проходится до конца`, async () => {
      const films = await loadFilms(lang.code);
      expect(films.length).toBeGreaterThanOrEqual(50);

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
