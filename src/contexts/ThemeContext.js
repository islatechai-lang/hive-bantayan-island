'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Apply theme to HTML root & sync with localStorage and mobile meta tag
  const applyTheme = useCallback((newTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', newTheme);
    root.style.colorScheme = newTheme;

    // Update theme-color meta tag for mobile browser notch / navigation bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const color = newTheme === 'dark' ? '#121013' : '#FFF5F5';
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('hive_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = prefersDark ? 'dark' : 'light';
        setThemeState(initialTheme);
        applyTheme(initialTheme);
      }
    } catch (e) {
      console.warn('Could not read saved theme:', e);
    }
    setMounted(true);
  }, [applyTheme]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('hive_theme', newTheme);
    } catch (e) {}
    applyTheme(newTheme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('hive_theme', next);
      } catch (e) {}
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
        mounted
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
