import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const ThemeModeContext = createContext({
  mode: 'light',
  toggleMode: () => {},
});

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const sessionSaved = sessionStorage.getItem('themeMode');
    if (sessionSaved === 'light' || sessionSaved === 'dark') return sessionSaved;

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
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


