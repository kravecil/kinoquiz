#!/usr/bin/env node
/**
 * Упаковывает dist/ в архив для загрузки в консоль разработчика Яндекс Игр.
 * index.html должен лежать в корне архива — поэтому пакуем содержимое папки, а не саму папку.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const out = join(root, `kinoquiz-yandex-${pkg.version}.zip`);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Нет dist/index.html — сначала выполните npm run build');
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!html.includes('sdk.js')) {
  console.error('В dist/index.html не подключён /sdk.js — это сборка не для Яндекс Игр (нужен npm run build)');
  process.exit(1);
}

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files[relative(dist, full).split('\\').join('/')] = readFileSync(full);
  }
};
walk(dist);

const zip = zipSync(files, { level: 9 });
writeFileSync(out, zip);
console.log(`Готово: ${relative(root, out)} — ${Object.keys(files).length} файлов, ${(zip.length / 1024).toFixed(0)} КБ`);
