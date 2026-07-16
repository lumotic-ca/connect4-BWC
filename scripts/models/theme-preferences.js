// Local-only color theme preference stored in the browser
export const THEME_PREFERENCE_KEY = 'c4-theme';

// Read the user's saved theme preference, if any
export function getThemePreference() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const theme = localStorage.getItem(THEME_PREFERENCE_KEY);
  return theme === 'light' || theme === 'dark' ? theme : null;
}

// Persist and apply a theme choice for this browser only
export function setThemePreference(theme) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_PREFERENCE_KEY, theme);
  }
  applyTheme(theme);
}

// Apply the theme to the document root without a page refresh
export function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Initialize theme from storage or fall back to the OS preference
export function initTheme() {
  applyTheme(getThemePreference());
}

// Resolve whether the UI should currently render in dark mode
export function isDarkMode() {
  const theme = getThemePreference();
  if (theme === 'dark') {
    return true;
  }
  if (theme === 'light') {
    return false;
  }
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// Toggle between light and dark mode for the local user only
export function toggleTheme() {
  setThemePreference(isDarkMode() ? 'light' : 'dark');
}
