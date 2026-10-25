import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeName } from '../types';
import { api } from '../api/client';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'midnight-cyan',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialTheme?: ThemeName }> = ({
  children,
  initialTheme = 'midnight-cyan',
}) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem('taskflow_theme') as ThemeName) || initialTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow_theme', theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('taskflow_theme', newTheme);
    // Persist to user settings silently
    api.updatePreferences({ theme: newTheme }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

