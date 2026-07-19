/**
 * ThemeContext — light/dark mode toggle.
 *
 * Adds/removes the `dark` class on <html> (Tailwind dark: styles key off
 * it) and remembers the choice in localStorage; first visit follows the
 * operating system's preference.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Provider — owns the dark/light state.
export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('medisync_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('medisync_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Flip dark ↔ light.
  const toggleTheme = () => setIsDark((d) => !d);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook: theme state + toggle.
export const useTheme = () => useContext(ThemeContext);
