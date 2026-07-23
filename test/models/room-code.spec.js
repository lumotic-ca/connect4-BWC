import { test, expect } from '@playwright/test';
import {
  normalizeRoomCode,
  isValidRoomCode,
  ROOM_CODE_LENGTH
} from '../../scripts/models/room-code.js';

test.describe('room code helpers', () => {
  test('ROOM_CODE_LENGTH should be 4', () => {
    expect(ROOM_CODE_LENGTH).toBe(4);
  });

  test('normalizeRoomCode should trim and uppercase input', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD');
    expect(normalizeRoomCode('XyZz')).toBe('XYZZ');
  });

  test('isValidRoomCode should accept 4 uppercase letters', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('WXYZ')).toBe(true);
  });

  test('isValidRoomCode should reject invalid formats', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(false);
    expect(isValidRoomCode('AB12')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });
});
