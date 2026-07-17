import { test, expect } from '@playwright/test';
import {
  MAX_CHAT_MESSAGES,
  CHAT_TYPING_TIMEOUT_MS,
  sanitizeChatText,
  createChatMessage,
  formatParticipantList
} from '../../server/chat.js';
import Player from '../../server/player.js';
import Room from '../../server/room.js';
import Spectator from '../../server/spectator.js';

test.describe('server chat', async () => {
  test('should sanitize chat text', async () => {
    expect(sanitizeChatText('  hello world  ')).toEqual('hello world');
    expect(sanitizeChatText('a'.repeat(600))).toHaveLength(500);
    expect(sanitizeChatText(null)).toEqual('');
  });

  test('should create chat messages', async () => {
    const message = createChatMessage({
      playerId: 'player-1',
      playerName: 'Cory',
      text: 'gg'
    });
    expect(message).toHaveProperty('type', 'user');
    expect(message).toHaveProperty('playerName', 'Cory');
    expect(message).toHaveProperty('text', 'gg');
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('sentAt');
  });

  test('should format participant list', async () => {
    const text = formatParticipantList({
      players: [
        new Player({ name: 'Alice', color: 'red' }),
        new Player({ name: 'Bob', color: 'blue' })
      ],
      spectators: [new Spectator({ name: 'Charlie' })]
    });
    expect(text).toContain('Alice (red)');
    expect(text).toContain('Bob (blue)');
    expect(text).toContain('Charlie (spectator)');
  });
});

test.describe('room chat history', async () => {
  test('should trim messages to the configured cap', async () => {
    const room = new Room({ code: 'ABCD' });
    for (let index = 0; index < MAX_CHAT_MESSAGES + 5; index += 1) {
      room.addMessage(
        createChatMessage({
          type: 'system',
          text: `message-${index}`
        })
      );
    }
    expect(room.messages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(room.messages[0].text).toEqual('message-5');
    expect(room.messages.at(-1).text).toEqual(`message-${MAX_CHAT_MESSAGES + 4}`);
  });

  test('should track typing participants', async () => {
    const room = new Room({ code: 'ABCD' });
    room.setParticipantTyping({
      participantId: 'player-1',
      playerName: 'Alice',
      typing: true
    });
    expect(room.typingParticipants).toHaveProperty('player-1', 'Alice');
    room.setParticipantTyping({
      participantId: 'player-1',
      playerName: 'Alice',
      typing: false
    });
    expect(room.typingParticipants).not.toHaveProperty('player-1');
  });

  test('should expose typing timeout constant', async () => {
    expect(CHAT_TYPING_TIMEOUT_MS).toEqual(3000);
  });
});
