// The number of characters in a room code, matching server-side generation
export const ROOM_CODE_LENGTH = 4;

// Normalize user-entered room code input (trim whitespace, uppercase letters)
export function normalizeRoomCode(input) {
  return input.trim().toUpperCase();
}

// Return whether a normalized room code matches the expected 4-letter A-Z format
export function isValidRoomCode(code) {
  return new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code);
}
