import { test, expect } from '@playwright/test';
import {
  getChatAudioEnabledPreference,
  setChatAudioEnabledPreference
} from '../scripts/models/chat-preferences.js';

test.describe('chat preferences', async () => {
  test('should default audio notifications to off', async () => {
    expect(getChatAudioEnabledPreference()).toEqual(false);
  });

  test('should persist audio notification preference', async () => {
    const storage = new Map();
    globalThis.sessionStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      }
    };

    setChatAudioEnabledPreference(true);
    expect(getChatAudioEnabledPreference()).toEqual(true);
    setChatAudioEnabledPreference(false);
    expect(getChatAudioEnabledPreference()).toEqual(false);

    delete globalThis.sessionStorage;
  });
});
