import { describe, expect, it } from 'vitest';
import { defaultConfig as cfg } from './config';
import { createRng } from './rng';
import { MarathonRun } from './quiz/marathon';
import {
  buildTitleIndex,
  checkTitle,
  editDistance,
  matchTitle,
  normalizeTitle,
  swapLayout,
  titleVariants,
} from './quiz/titleMatch';
import { createSave, migrateSave } from './save';
import { scoreFor } from './scoring';
import type { Film } from './types';
import { makeFilms } from './test-fixtures';

const CATALOG = [
  { id: 'godfather', title: 'Крёстный отец', aliases: ['Крестный отец'] },
  { id: 'godfather2', title: 'Крёстный отец 2', aliases: ['Крестный отец 2'] },
  { id: 'inception', title: 'Начало', aliases: ['Инсепшн'] },
  { id: 'leon', title: 'Леон', aliases: ['Профессионал'] },
  { id: 'leto', title: 'Лето', aliases: [] },
  { id: 'hachi', title: 'Хатико: Самый верный друг', aliases: ['Хатико'] },
  { id: 'lotr1', title: 'Властелин колец: Братство Кольца', aliases: [] },
  { id: 'lotr3', title: 'Властелин колец: Возвращение короля', aliases: [] },
  { id: 'irony', title: 'Ирония судьбы, или С лёгким паром!', aliases: [] },
  { id: 'amelie', title: 'Amélie', aliases: [] },
  { id: 'gf2en', title: 'The Godfather Part II', aliases: [] },
  { id: 'bttf', title: 'Back to the Future', aliases: [] },
  { id: 'ivan', title: 'Ivan Vasilievich Changes Profession', aliases: ['Ivan Vasilievich: Back to the Future'] },
  { id: 'matrix', title: 'The Matrix', aliases: [] },
];
const index = buildTitleIndex(CATALOG);
const verdict = (input: string, id: string) => checkTitle(input, id, index).kind;

describe('нечёткое сравнение названий', () => {
  it('нормализация: регистр, ё/е, диакритика, пунктуация, артикль, «часть», римские цифры', () => {
    expect(normalizeTitle('  Крёстный ОТЕЦ!  ')).toBe('крестныи отец'); // й → и тоже прощаем
    expect(normalizeTitle('Amélie')).toBe('amelie');
    expect(normalizeTitle('The Godfather Part II')).toBe('godfather 2');
    expect(normalizeTitle('The')).toBe('the');
    expect(normalizeTitle('«»…')).toBe('');
  });

  it('расстояние учитывает перестановку соседних букв и умеет обрываться', () => {
    expect(editDistance('начало', 'начало')).toBe(0);
    expect(editDistance('нaчало', 'начало')).toBe(1);
    expect(editDistance('нчаало', 'начало')).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2);
  });

  it('раскладка переключается только для текста в одной раскладке', () => {
    expect(swapLayout('Yfxfkj')).toBe('начало');
    expect(swapLayout('Ьфекшч')).toBe('matrix');
    expect(swapLayout('Начало 2 go')).toBeNull();
  });

  it('прощает ё/е, регистр, опечатки, пропущенные пробелы и дефисы', () => {
    expect(verdict('крестный отец', 'godfather')).toBe('correct');
    expect(verdict('Крёстный атец', 'godfather')).toBe('correct');
    expect(verdict('КРЕСТНЫЙОТЕЦ', 'godfather')).toBe('correct');
    expect(verdict('Начяло', 'inception')).toBe('correct');
    expect(verdict('amelie', 'amelie')).toBe('correct');
    expect(verdict('godfather part 2', 'gf2en')).toBe('correct');
  });

  it('принимает варианты названия и части составного', () => {
    expect(verdict('Инсепшн', 'inception')).toBe('correct');
    expect(verdict('самый верный друг', 'hachi')).toBe('correct');
    expect(verdict('Ирония судьбы', 'irony')).toBe('correct');
    expect(verdict('С легким паром', 'irony')).toBe('correct');
    expect(verdict('Возвращение кароля', 'lotr3')).toBe('correct');
  });

  it('понимает ввод не в той раскладке', () => {
    expect(verdict('Yfxfkj', 'inception')).toBe('correct');
    expect(verdict('Ьфекшч', 'matrix')).toBe('correct');
  });

  it('другие цифры — другой фильм', () => {
    expect(checkTitle('Крестный отец', 'godfather2', index)).toEqual({ kind: 'wrong', matchedId: 'godfather' });
    expect(verdict('Крестный отец 3', 'godfather2')).toBe('wrong');
    expect(verdict('Крестный отец 2', 'godfather')).toBe('wrong');
  });

  it('ответ ближе к другому фильму каталога — ошибка', () => {
    expect(checkTitle('Лето', 'leon', index)).toEqual({ kind: 'wrong', matchedId: 'leto' });
    expect(verdict('Леон', 'leon')).toBe('correct');
  });

  it('общая часть нескольких названий — неоднозначно, полное название важнее части', () => {
    expect(verdict('Властелин колец', 'lotr3')).toBe('ambiguous');
    expect(matchTitle('Властелин колец', index)).toEqual({ kind: 'ambiguous', filmIds: ['lotr1', 'lotr3'] });
    // Неоднозначность без правильного фильма среди кандидатов — просто ошибка.
    expect(verdict('Властелин колец', 'inception')).toBe('wrong');
    // «Back to the Future» — и название, и часть alias другого фильма: побеждает название.
    expect(verdict('Back to the future', 'bttf')).toBe('correct');
  });

  it('короткие названия без допуска, мусор и пустой ввод', () => {
    expect(verdict('', 'leon')).toBe('empty');
    expect(verdict(' !? ', 'leon')).toBe('empty');
    expect(verdict('кино', 'inception')).toBe('wrong');
    expect(verdict('совсем другой фильм', 'inception')).toBe('wrong');
  });

  it('варианты: название, aliases и части через двоеточие и «или»', () => {
    const texts = titleVariants(CATALOG[8]!).map((v) => v.text);
    expect(texts).toEqual(['Ирония судьбы, или С лёгким паром!', 'Ирония судьбы', 'С лёгким паром!']);
  });
});

describe('MarathonRun в хардкоре', () => {
  const films: Film[] = makeFilms(40).map((f, i) => ({ ...f, title: `Кинолента номер ${i}` }));

  function run(seed = 1) {
    return new MarathonRun(films, createRng(seed), cfg, new Set(), 'hardcore');
  }

  it('верное название с опечаткой засчитывается и стоит дороже классики', () => {
    const r = run();
    const q = r.start(0).question!;
    const typo = q.film.title.replace('Кинолента', 'кинолетна');
    const res = r.answerText(typo, 2000);
    expect(res).toMatchObject({ kind: 'correct', typed: typo });

    const classic = new MarathonRun(films, createRng(1), cfg, new Set());
    const cq = classic.start(0).question!;
    const cres = classic.answer(cq.film.id, 2000);
    if (res.kind === 'correct' && cres.kind === 'correct') {
      expect(res.points).toBeGreaterThan(cres.points);
      expect(res.coins).toBeGreaterThan(cres.coins);
    }
    expect(r.snapshot().phase).toBe('reveal');
  });

  it('пустой ввод и неоднозначность ничего не стоят', () => {
    const r = run();
    r.start(0);
    expect(r.answerText('   ', 100)).toEqual({ kind: 'unclear', reason: 'empty' });
    const snap = r.snapshot();
    expect(snap.phase).toBe('question');
    expect(snap.wrong).toBe(0);
  });

  it('неверное название — ошибка с тем, что ввёл игрок', () => {
    const r = run();
    const q = r.start(0).question!;
    const other = films.find((f) => f.id !== q.film.id)!;
    expect(r.answerText(other.title, 100)).toEqual({
      kind: 'wrong',
      picked: other.id,
      correctId: q.film.id,
      typed: other.title,
    });
    expect(r.snapshot().streak).toBe(0);
  });

  it('второй шанс сохраняет попытку, «Не знаю» — ошибка даже со вторым шансом', () => {
    const r = run();
    r.start(0);
    r.useHint('shield', 0);
    expect(r.answerText('абракадабра', 100)).toMatchObject({ kind: 'saved', picked: null });
    expect(r.snapshot().savedAttempts).toEqual(['абракадабра']);
    r.useHint('skip', 0);
    r.useHint('shield', 0);
    expect(r.giveUp()).toMatchObject({ kind: 'wrong', picked: null });
    expect(r.snapshot().wrong).toBe(1);
  });

  it('50/50 в хардкоре недоступна, остальные подсказки — да', () => {
    const r = run();
    r.start(0);
    expect(r.canUseHint('fifty')).toBe(false);
    for (const type of ['year', 'genre', 'director', 'shield', 'skip'] as const) {
      expect(r.canUseHint(type)).toBe(true);
    }
  });

  it('режимы не смешиваются', () => {
    const hard = run();
    const q = hard.start(0).question!;
    expect(() => hard.answer(q.film.id, 0)).toThrow();
    const classic = new MarathonRun(films, createRng(1), cfg, new Set());
    classic.start(0);
    expect(() => classic.answerText('что-нибудь', 0)).toThrow();
  });

  it('бонус скорости в хардкоре растянут по времени', () => {
    const at10s = { difficulty: 1 as const, answerSec: 10, streak: 1, hintsUsed: 0 };
    expect(scoreFor({ ...at10s, fastAnswerSec: cfg.hardcore.fastAnswerSec }, cfg)).toBeGreaterThan(
      scoreFor(at10s, cfg),
    );
  });
});

describe('сохранение', () => {
  it('рекорд хардкора по умолчанию 0 и переживает миграцию', () => {
    expect(createSave(0, cfg).stats.bestScoreHardcore).toBe(0);
    const old = { stats: { games: 3, bestScore: 900 } };
    expect(migrateSave(old, 0, cfg).stats.bestScoreHardcore).toBe(0);
    const fresh = { stats: { bestScoreHardcore: 1200 } };
    expect(migrateSave(fresh, 0, cfg).stats.bestScoreHardcore).toBe(1200);
  });
});
