import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import antdEnUS from 'antd/locale/en_US';
import antdZhCN from 'antd/locale/zh_CN';
import en from './en';
import zh from './zh';

const DICTIONARIES = { en, zh };
const ANTD_LOCALES = { en: antdEnUS, zh: antdZhCN };
const DAYJS_LOCALES = { en: 'en', zh: 'zh-cn' };
const STORAGE_KEY = 'tp_lang';

export const LANGUAGES = [
  { value: 'en', label: 'EN' },
  { value: 'zh', label: '中文' },
];

/** Browser preference on a first visit, so a Chinese user does not land on English. */
function initialLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && DICTIONARIES[saved]) {
    return saved;
  }
  const preferred = (navigator.languages || [navigator.language || 'en']).find((tag) =>
    /^zh\b/i.test(tag),
  );
  return preferred ? 'zh' : 'en';
}

function fill(template, params) {
  if (!params) {
    return template;
  }
  return String(template).replace(/\{(\w+)\}/g, (whole, name) =>
    params[name] === undefined ? whole : String(params[name]),
  );
}

/** The name NewTripModal gives a trip when the traveller leaves the field blank. */
export function defaultTripTitle(lang, days, city) {
  return fill(DICTIONARIES[lang]['newTrip.defaultTitle'], { days, city });
}

/**
 * Which language's auto-naming template produced `title` — or null if the traveller typed their own.
 * Checked across every dictionary because the trip may have been created before the language was
 * switched, and "San Francisco 3 天" is just as auto-generated as "3 days in San Francisco".
 */
export function autoNamedIn(title, days, city) {
  return Object.keys(DICTIONARIES).find((lang) => defaultTripTitle(lang, days, city) === title) ?? null;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    dayjs.locale(DAYJS_LOCALES[lang]);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  /**
   * Looks up `key` and substitutes `{name}` placeholders.
   *
   * A missing key falls back to `fallback`, then to the other language, then to the key itself —
   * a gap in one dictionary shows the other language rather than a blank or a raw identifier. That
   * matters most for server-sent codes, whose English text always arrives alongside the code.
   */
  const t = useCallback(
    (key, params, fallback) => {
      const template =
        DICTIONARIES[lang][key] ??
        fallback ??
        DICTIONARIES[lang === 'zh' ? 'en' : 'zh'][key] ??
        key;
      return fill(template, params);
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang: setLangState, t, antdLocale: ANTD_LOCALES[lang] }),
    [lang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return context;
}
