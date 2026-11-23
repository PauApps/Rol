import { caDictionary } from './ca';
import type { SupportedLocale, TranslationDictionary } from './types';

const DICTIONARIES: Partial<Record<SupportedLocale, TranslationDictionary>> = {
  ca: caDictionary,
};

export const DEFAULT_LOCALE: SupportedLocale = 'ca';

/**
 * Returns the UI dictionary for the requested locale, falling back cleanly to Catalan.
 * Note: UI locale is independent from the language of uploaded manuals (DOCUMENT_MESTRE.md §11).
 */
export function getDictionary(locale: string = DEFAULT_LOCALE): TranslationDictionary {
  if (locale === 'ca') {
    return caDictionary;
  }
  return DICTIONARIES[locale as SupportedLocale] ?? caDictionary;
}

export * from './types';
