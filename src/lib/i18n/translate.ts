import { en, type TranslationDictionary, type TranslationKey } from "./dictionaries/en";
import { zh } from "./dictionaries/zh";
import type { Language } from "./locale";

export type TranslationVariables = Record<string, string | number>;

export const dictionaries: Record<Language, TranslationDictionary> = {
  zh,
  en,
};

export function translate(
  language: Language,
  key: TranslationKey,
  variables: TranslationVariables = {},
) {
  const template = dictionaries[language][key];

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, variable: string) =>
    Object.prototype.hasOwnProperty.call(variables, variable)
      ? String(variables[variable])
      : match,
  );
}

export type { TranslationKey };

