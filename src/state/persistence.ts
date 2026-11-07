import { createSave, migrateSave, newerSave, type SaveData } from '@/core/save';
import { config, now, platform, save } from './app';

/**
 * Сохранения: локальная копия пишется сразу, облачная — с задержкой,
 * чтобы не дёргать площадку на каждый клик. При загрузке берём более свежую копию.
 */

const LOCAL_KEY = 'kinoquiz.save';
const CLOUD_DELAY_MS = 1500;

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

function scheduleCloud(): void {
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => void flushSave(), CLOUD_DELAY_MS);
}

/** Немедленная запись в облако (после покупок и в конце забега). */
export async function flushSave(): Promise<void> {
  if (cloudTimer) {
    clearTimeout(cloudTimer);
    cloudTimer = null;
  }
  const data = save.value;
  if (!data) return;
  try {
    await platform().storage.save(data);
  } catch (err) {
    console.warn('[save] облако недоступно', err);
  }
}

/** При уходе со страницы пытаемся дописать облачное сохранение. */
export function installSaveOnHide(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flushSave();
  });
}
