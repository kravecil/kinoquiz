#!/usr/bin/env node
/**
 * Добавляет пачку фильмов в каталог.
 *
 *   node tools/add-films.mjs path/to/batch.json
 *
 * Формат пачки — массив:
 *   {
 *     "id": "snake_case", "year": 1999, "genres": ["drama"], "countries": ["US"], "popularity": 1,
 *     "ru": { "title": "…", "aliases": [], "director": "…", "descriptions": ["лёгкое", "сложное"] },
 *     "en": { … }
 *   }
 * Языки берутся из src/content/texts/*.json: для каждого должен быть блок с таким кодом.
 * После добавления запустите `npm run content:check`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src/content');
const batchPath = process.argv[2];
if (!batchPath) {
  console.error('Укажите файл пачки: node tools/add-films.mjs batch.json');
  process.exit(1);
}

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const filmsPath = join(contentDir, 'films.json');
const films = JSON.parse(readFileSync(filmsPath, 'utf8'));
const existing = new Set(films.map((f) => f.id));

const langs = readdirSync(join(contentDir, 'texts'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));
const texts = Object.fromEntries(
  langs.map((l) => [l, JSON.parse(readFileSync(join(contentDir, 'texts', `${l}.json`), 'utf8'))]),
);

const problems = [];
for (const item of batch) {
  if (existing.has(item.id)) problems.push(`«${item.id}» уже есть в каталоге`);
  for (const l of langs) if (!item[l]) problems.push(`«${item.id}»: нет блока «${l}»`);
  existing.add(item.id);
}
if (problems.length) {
  for (const p of problems) console.error('✖ ', p);
  process.exit(1);
}

for (const item of batch) {
  const { id, year, genres, countries, popularity } = item;
  films.push({ id, year, genres, countries, popularity });
  for (const l of langs) {
    const t = item[l];
    texts[l][id] = { title: t.title, aliases: t.aliases ?? [], director: t.director, descriptions: t.descriptions };
  }
}

// films.json: один фильм на строку — так удобнее читать диффы.
writeFileSync(filmsPath, `[\n${films.map((f) => `  ${JSON.stringify(f)}`).join(',\n')}\n]\n`);
for (const l of langs) {
  writeFileSync(join(contentDir, 'texts', `${l}.json`), `${JSON.stringify(texts[l], null, 2)}\n`);
}
console.log(`Добавлено фильмов: ${batch.length}. Всего в каталоге: ${films.length}.`);
