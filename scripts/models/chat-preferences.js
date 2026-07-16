// Persist whether chat notification sounds are enabled (default off)
export const CHAT_AUDIO_ENABLED_KEY = 'c4-chat-audio-enabled';

// Read the saved chat audio preference from session storage
export function getChatAudioEnabledPreference() {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(CHAT_AUDIO_ENABLED_KEY) === 'true';
}

// Save the chat audio preference to session storage
export function setChatAudioEnabledPreference(enabled) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(CHAT_AUDIO_ENABLED_KEY, enabled ? 'true' : 'false');
  }
}
