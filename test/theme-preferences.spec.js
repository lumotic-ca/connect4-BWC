import { test, expect } from '@playwright/test';
import {
  applyTheme,
  getThemePreference,
  isDarkMode,
  setThemePreference,
  toggleTheme
} from '../scripts/models/theme-preferences.js';

test.describe('theme preferences', async () => {
  test('should default to no saved theme preference', async () => {
    expect(getThemePreference()).toBeNull();
  });

  test('should persist theme preference locally', async () => {
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      }
    };
    globalThis.document = {
      documentElement: {
        setAttribute: () => {},
        removeAttribute: () => {}
      }
    };

    setThemePreference('dark');
    expect(getThemePreference()).toEqual('dark');
    setThemePreference('light');
    expect(getThemePreference()).toEqual('light');

    delete globalThis.localStorage;
    delete globalThis.document;
  });

  test('should resolve dark mode from saved preference', async () => {
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      }
    };
    globalThis.document = {
      documentElement: {
        setAttribute: () => {},
        removeAttribute: () => {}
      }
    };

    setThemePreference('dark');
    expect(isDarkMode()).toEqual(true);
    toggleTheme();
    expect(isDarkMode()).toEqual(false);

    delete globalThis.localStorage;
    delete globalThis.document;
  });

  test('should apply theme attribute to the document root', async () => {
    const attributes = new Map();
    globalThis.document = {
      documentElement: {
        setAttribute: (key, value) => {
          attributes.set(key, value);
        },
        removeAttribute: (key) => {
          attributes.delete(key);
        }
      }
    };

    applyTheme('dark');
    expect(attributes.get('data-theme')).toEqual('dark');
    applyTheme(null);
    expect(attributes.has('data-theme')).toEqual(false);

    delete globalThis.document;
  });
});
