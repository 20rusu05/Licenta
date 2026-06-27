import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Dictionarul ramane mic aici; textele mari stau direct in componente.
const translations = {
  ro: {
    'brand.name': 'NewMed',
    'common.logout': 'Deconectare',
    'theme.dark': 'Mod întunecat',
    'theme.light': 'Mod luminos',
    'language.ro': 'RO',
    'language.en': 'EN',
  },
  en: {
    'brand.name': 'NewMed',
    'common.logout': 'Logout',
    'theme.dark': 'Dark mode',
    'theme.light': 'Light mode',
    'language.ro': 'RO',
    'language.en': 'EN',
  },
};

// Interpolarea permite texte de forma "Salut, {{name}}" fara o librarie separata.
function interpolate(template, values = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''));
}

const defaultValue = {
  lang: 'ro',
  setLang: () => {},
  toggleLang: () => {},
  t: (key, values) => interpolate(translations.ro[key] || key, values),
  locale: 'ro-RO',
};

export const LanguageContext = createContext(defaultValue);

export function LanguageProvider({ children }) {
  // Limba ramane pe durata sesiunii si seteaza atributul lang pentru accesibilitate.
  const [lang, setLangState] = useState(() => {
    if (typeof window === 'undefined') {
      return 'ro';
    }

    const stored = sessionStorage.getItem('language');
    return stored === 'en' || stored === 'ro' ? stored : 'ro';
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    sessionStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((nextLang) => {
    setLangState(nextLang === 'en' ? 'en' : 'ro');
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ro' ? 'en' : 'ro'));
  }, []);

  const t = useCallback((key, values) => interpolate(translations[lang]?.[key] || translations.ro[key] || key, values), [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    toggleLang,
    t,
    locale: lang === 'en' ? 'en-GB' : 'ro-RO',
  }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
