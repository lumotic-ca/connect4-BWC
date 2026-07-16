import { v4 as uuidv4 } from 'uuid';

// Maximum number of chat messages retained per room
export const MAX_CHAT_MESSAGES = 500;

// Maximum length of a single chat message body
export const MAX_CHAT_MESSAGE_LENGTH = 500;

// Minimum interval between messages from the same socket (ms)
export const CHAT_RATE_LIMIT_MS = 500;

// Remove unsafe content and enforce length limits on user-submitted chat text
export function sanitizeChatText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

// Build a chat message object for storage and broadcast
export function createChatMessage({ type = 'user', playerId = null, playerName = null, text }) {
  return {
    id: uuidv4(),
    type,
    playerId,
    playerName,
    text,
    sentAt: Date.now()
  };
}

// Summarize everyone currently in the room for a system chat line
export function formatParticipantList({ players, spectators }) {
  const participantLabels = [];

  players.forEach((player) => {
    const connectionState = player.connected ? '' : ' (offline)';
    participantLabels.push(`${player.name} (${player.color})${connectionState}`);
  });

  spectators.forEach((spectator) => {
    const connectionState = spectator.connected ? '' : ' (offline)';
    participantLabels.push(`${spectator.name} (spectator)${connectionState}`);
  });

  if (participantLabels.length === 0) {
    return 'In this session: no participants';
  }

  return `In this session: ${participantLabels.join(', ')}`;
}
