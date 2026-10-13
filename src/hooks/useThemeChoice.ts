import { useCallback, useEffect, useState } from 'react';

/**
 * The application's colour-theme choice, as the one storage contract the rest of
 * the product already writes.
 *
 * `lxDarkManual` records only that a person made a choice; `lxDark` carries the
 * chosen value. While no choice has been made the system preference wins and
 * keeps winning as it changes. `main.tsx` reads the same two keys before React
 * mounts, so first paint never shows the wrong theme.
 *
 * This exists because the panel renders outside the user-facing application
 * shell, where nothing else applies the attribute. It centralises the existing
 * contract rather than introducing a second one.
 */
const MANUAL_KEY = 'lxDarkManual';
const VALUE_KEY = 'lxDark';

function systemPrefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readDark() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.localStorage.getItem(MANUAL_KEY) !== null) {
    return window.localStorage.getItem(VALUE_KEY) === 'true';
  }
  return systemPrefersDark();
}

export function useThemeChoice() {
  const [dark, setDark] = useState(readDark);

  // Applied on mount as well as on change: the panel is reachable directly by
  // URL, where nothing else has set the attribute for this route.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // The system preference keeps steering the theme until a choice is stored.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem(MANUAL_KEY) === null) {
        setDark(event.matches);
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((next: boolean) => {
    window.localStorage.setItem(MANUAL_KEY, '1');
    window.localStorage.setItem(VALUE_KEY, String(next));
    setDark(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(!readDark());
  }, [setTheme]);

  return { dark, setTheme, toggleTheme };
}
