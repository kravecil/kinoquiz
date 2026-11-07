import { createSave, migrateSave, newerSave, type SaveData } from '@/core/save';
import { config, now, platform, save } from './app';

/**
 * Сохранения: локальная копия пишется сразу, облачная — с задержкой,
 * чтобы не дёргать площадку на каждый клик. При загрузке берём более свежую копию.
 */

const LOCAL_KEY = 'kinoquiz.save';
const CLOUD_DELAY_MS = 2000;

let cloudTimer: ReturnType<typeof setTimeout> | null = null;

function readLocal(): unknown {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(data: SaveData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* приватный режим или переполнение — работаем без локальной копии */
  }
}

export async function loadSave(): Promise<SaveData> {
  const t = now();
  const localRaw = readLocal();
  let cloudRaw: unknown = null;
  try {
    cloudRaw = await platform().storage.load();
  } catch {
    cloudRaw = null;
  }
  const local = localRaw ? migrateSave(localRaw, t, config) : null;
  const cloud = cloudRaw ? migrateSave(cloudRaw, t, config) : null;
  const data = newerSave(local, cloud) ?? createSave(t, config);
  save.value = data;
  return data;
}

/** Изменяет сохранение и планирует запись. */
export function updateSave(mutate: (draft: SaveData) => SaveData | void): SaveData {
  const current = save.value;
  if (!current) throw new Error('Сохранение ещё не загружено');
  const draft = structuredClone(current);
  const result = mutate(draft) ?? draft;
  result.savedAt = now();
  save.value = result;
  writeLocal(result);
  scheduleCloud();
  return result;
}

/**
 * Облако площадки ограничивает частоту записи (у Яндекса — 100 запросов за 5 минут),
 * поэтому обычные изменения копим и пишем не чаще раза в CLOUD_MIN_INTERVAL_MS.
 */
const CLOUD_MIN_INTERVAL_MS = 5000;
let lastCloudAt = 0;
let cloudDirty = false;

function scheduleCloud(): void {
  cloudDirty = true;
  if (cloudTimer) return;
  const wait = Math.max(CLOUD_DELAY_MS, lastCloudAt + CLOUD_MIN_INTERVAL_MS - Date.now());
  cloudTimer = setTimeout(() => {
    cloudTimer = null;
    void writeCloud();
  }, wait);
}

async function writeCloud(): Promise<void> {
  const data = save.value;
  if (!data) return;
  cloudDirty = false;
  lastCloudAt = Date.now();
  try {
    await platform().storage.save(data);
  } catch (err) {
    cloudDirty = true;
    console.warn('[save] облако недоступно', err);
  }
}

/**
 * Запись в облако без ожидания.
 * `force` — сразу, даже если недавно уже писали (только для покупок: они редкие и важные).
 * Без `force` — сразу, если лимит позволяет, иначе в ближайшее разрешённое время.
 */
export async function flushSave(options: { force?: boolean } = {}): Promise<void> {
  if (!cloudDirty && !options.force) return;
  if (!options.force && Date.now() - lastCloudAt < CLOUD_MIN_INTERVAL_MS) {
    scheduleCloud();
    return;
  }
  if (cloudTimer) {
    clearTimeout(cloudTimer);
    cloudTimer = null;
  }
  await writeCloud();
}

/** При уходе со страницы пытаемся дописать облачное сохранение. */
export function installSaveOnHide(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flushSave();
  });
}
