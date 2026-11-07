#!/usr/bin/env node
/**
 * Проверка контента перед сборкой:
 *  - у каждого фильма есть тексты на всех языках, лишних текстов нет;
 *  - корректные жанры, годы, популярность, страны;
 *  - в описаниях нет слов из названия (иначе вопрос решается сам собой);
 *  - разумная длина описаний.
 * Ошибки валят сборку, предупреждения только выводятся.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src/content');

const GENRES = new Set([
  'drama', 'comedy', 'crime', 'thriller', 'scifi', 'fantasy', 'adventure', 'action', 'animation',
  'family', 'romance', 'war', 'horror', 'mystery', 'biography', 'history', 'musical', 'western',
]);
const STOPWORDS = new Set([
  'the', 'and', 'of', 'a', 'an', 'to', 'in', 'if', 'you', 'can', 'here', 'are', 'does', 'not', 'other',
  'или', 'и', 'в', 'с', 'из', 'на', 'по', 'не', 'а', 'здесь', 'самый', 'другие', 'меня', 'если',
]);
const MIN_LEN = 40;
const MAX_LEN = 260;

const errors = [];
const warnings = [];

const films = JSON.parse(readFileSync(join(contentDir, 'films.json'), 'utf8'));
const ids = new Set();
for (const f of films) {
  if (ids.has(f.id)) errors.push(`films.json: повторяется id «${f.id}»`);
  ids.add(f.id);
  if (!/^[a-z0-9_]+$/.test(f.id)) errors.push(`${f.id}: id должен быть в snake_case`);
  if (!Number.isInteger(f.year) || f.year < 1890 || f.year > 2030) errors.push(`${f.id}: странный год ${f.year}`);
  if (![1, 2, 3].includes(f.popularity)) errors.push(`${f.id}: popularity должна быть 1..3`);
  if (!Array.isArray(f.genres) || f.genres.length === 0) errors.push(`${f.id}: нет жанров`);
  for (const g of f.genres ?? []) if (!GENRES.has(g)) errors.push(`${f.id}: неизвестный жанр «${g}»`);
  for (const c of f.countries ?? []) if (!/^[A-Z]{2}$/.test(c)) errors.push(`${f.id}: код страны «${c}»`);
}

const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (s) => normalize(s).split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w));

const textsDir = join(contentDir, 'texts');
const langs = readdirSync(textsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));

for (const lang of langs) {
  const texts = JSON.parse(readFileSync(join(textsDir, `${lang}.json`), 'utf8'));
  for (const id of ids) if (!texts[id]) errors.push(`[${lang}] нет текста для «${id}»`);
  for (const id of Object.keys(texts)) if (!ids.has(id)) errors.push(`[${lang}] лишний текст «${id}»`);

  for (const [id, t] of Object.entries(texts)) {
    const where = `[${lang}] ${id}`;
    if (!t.title?.trim()) errors.push(`${where}: пустое название`);
    if (!t.director?.trim()) errors.push(`${where}: нет режиссёра`);
    if (!Array.isArray(t.descriptions) || t.descriptions.length !== 2) {
      errors.push(`${where}: нужно ровно 2 описания (лёгкое и сложное)`);
      continue;
    }
    const titleWords = new Set([t.title, ...(t.aliases ?? [])].flatMap(words));
    t.descriptions.forEach((d, i) => {
      if (d.length < MIN_LEN) warnings.push(`${where} #${i + 1}: короткое описание (${d.length})`);
      if (d.length > MAX_LEN) warnings.push(`${where} #${i + 1}: длинное описание (${d.length}), на телефоне не влезет`);
      const leaked = words(d).filter((w) => titleWords.has(w));
      if (leaked.length) errors.push(`${where} #${i + 1}: в описании слова из названия: ${[...new Set(leaked)].join(', ')}`);
    });
  }
}

for (const w of warnings) console.warn('⚠ ', w);
for (const e of errors) console.error('✖ ', e);
console.log(`Контент: ${films.length} фильмов, языки: ${langs.join(', ')}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
