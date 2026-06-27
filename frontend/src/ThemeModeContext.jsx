import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

// Contextul expune doar modul curent si actiunea de schimbare.
export const ThemeModeContext = createContext({
  mode: 'light',
  toggleMode: () => {},
});

export function ThemeModeProvider({ children }) {
  // Preferinta de tema foloseste sesiunea curenta, cu fallback la setarea sistemului.
  const [mode, setMode] = useState(() => {
    const sessionSaved = sessionStorage.getItem('themeMode');
    if (sessionSaved === 'light' || sessionSaved === 'dark') return sessionSaved;

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    // data-theme permite stiluri globale dependente de tema, in afara MUI.
    sessionStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
  );
}
