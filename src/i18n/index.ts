import { signal } from '@preact/signals';
import ruDictionary from './locales/ru';
import { findLanguage } from './languages';
import type { Dictionary, MessageKey, PluralForms, PluralKey, TextKey } from './types';

export { LANGUAGES, resolveLang } from './languages';
export type { MessageKey } from './types';

type Params = Record<string, string | number>;

/** Текущий язык. Компоненты, читающие t(), перерисуются при его смене. */
export const currentLang = signal('ru');
const dictionary = signal<Partial<Dictionary>[]>([ruDictionary]);

/** Загружает словарь языка вместе с цепочкой fallback-языков. */
export async function setLanguage(code: string): Promise<void> {
  const chain: Partial<Dictionary>[] = [];
  let lang: string | null = code;
  const visited = new Set<string>();
  while (lang && !visited.has(lang)) {
    visited.add(lang);
    const def = findLanguage(lang);
    chain.push(await def.dictionary());
    lang = def.fallback;
  }
  chain.push(ruDictionary);
  dictionary.value = chain;
  currentLang.value = code;
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

function lookup<K extends MessageKey>(key: K): Dictionary[K] | undefined {
  for (const dict of dictionary.value) {
    const value = dict[key];
    if (value !== undefined) return value as Dictionary[K];
  }
  return undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

/** Простая строка: t('menu.play'), t('menu.best', { n: 1200 }). */
export function t(key: TextKey, params?: Params): string {
  const value = lookup(key);
  return typeof value === 'string' ? interpolate(value, params) : key;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();

/** Множественное число: tn('unit.tickets', 3) → «3 билета». */
export function tn(key: PluralKey, n: number, params?: Params): string {
  const forms = lookup(key) as PluralForms | undefined;
  if (!forms) return String(n);
  const lang = currentLang.value;
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  const category = rules.select(n) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return interpolate(template, { n: formatNumber(n), ...params });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(currentLang.value).format(n);
}

/** Название страны по коду ISO на текущем языке. */
export function countryName(code: string): string {
  // Исторических стран (СССР) нет в Intl.DisplayNames — берём из словаря.
  if (code === 'SU') return t('country.SU');
  try {
    return new Intl.DisplayNames([currentLang.value], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** «12:05» или «1:02:05». */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
