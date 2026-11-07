import type ru from './locales/ru';

export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;
export type Messages = Record<string, Message>;

export type MessageKey = keyof typeof ru;

/** Ключи, у которых есть формы множественного числа. */
export type PluralKey = {
  [K in MessageKey]: (typeof ru)[K] extends string ? never : K;
}[MessageKey];

export type TextKey = Exclude<MessageKey, PluralKey>;

/** Полный словарь: такой же набор ключей, как в ru. */
export type Dictionary = {
  [K in MessageKey]: (typeof ru)[K] extends string ? string : PluralForms;
};
