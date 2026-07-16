import moment from 'moment';

import { MAX_CHAT_MESSAGES, createChatMessage, formatParticipantList } from './chat.js';
import Player from './player.js';
import Game from './game.js';
import Spectator from './spectator.js';

class Room {
  constructor({ code, players = [], game = new Game({ players }), messages = [] }) {
    this.code = code;
    this.players = players;
    this.game = game;
    // Non-playing observers who can read and send chat messages
    this.spectators = [];
    // Persisted chat history for the lifetime of the room
    this.messages = messages;
    // The date/time the room was last seen completely empty (i.e. both players
    // were disconnected)
    this.lastMarkedInactive = null;
    // Per-socket rate limiting timestamps for chat
    this.lastChatMessageAtBySocketId = {};
  }

  addPlayer({ player, socket }) {
    player = new Player(player);
    this.players.push(player);
    player.socket = socket;
    socket.player = player;
    player.room = this;
    socket.room = this;
    socket.join(this.code);
    return player;
  }

  addSpectator({ spectator, socket }) {
    spectator = new Spectator(spectator);
    this.spectators.push(spectator);
    spectator.socket = socket;
    socket.spectator = spectator;
    spectator.room = this;
    socket.room = this;
    socket.join(this.code);
    return spectator;
  }

  getPlayerById(playerId) {
    return this.players.find((player) => player.id === playerId);
  }

  getSpectatorById(spectatorId) {
    return this.spectators.find((spectator) => spectator.id === spectatorId);
  }

  getFirstDisconnectedPlayer() {
    return this.players.find((player) => player.socket === null);
  }

  connectPlayer({ playerId, socket }) {
    const player = this.getPlayerById(playerId) || this.getFirstDisconnectedPlayer();
    if (player) {
      player.socket = socket;
      socket.player = player;
      socket.room = this;
      socket.join(this.code);
    }
    return player;
  }

  connectSpectator({ spectatorId, socket }) {
    const spectator = this.getSpectatorById(spectatorId);
    if (spectator) {
      spectator.socket = socket;
      socket.spectator = spectator;
      socket.room = this;
      socket.join(this.code);
    }
    return spectator;
  }

  // Append a message and trim the oldest entries when the cap is exceeded
  addMessage(message) {
    this.messages.push(message);
    if (this.messages.length > MAX_CHAT_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_CHAT_MESSAGES);
    }
    return message;
  }

  // Post a system message listing everyone currently in the room
  addParticipantListMessage() {
    const text = formatParticipantList({
      players: this.players,
      spectators: this.spectators
    });
    const message = createChatMessage({ type: 'system', text });
    this.addMessage(message);
    this.broadcastToAll('chat-message', { message });
    return message;
  }

  // Broadcast to all players in the room
  broadcast(eventName, data) {
    this.players.forEach((player) => {
      if (player !== this) {
        player.emit(eventName, player.injectLocalPlayer(data));
      }
    });
  }

  // Broadcast to every connected player and spectator in the room
  broadcastToAll(eventName, data, { excludeSocket = null } = {}) {
    [...this.players, ...this.spectators].forEach((participant) => {
      if (participant.socket && participant.socket !== excludeSocket) {
        participant.socket.emit(eventName, data);
      }
    });
  }

  // Return true if all players are currently disconnected from the room;
  // otherwise, return false
  isEmpty() {
    return this.players.every((player) => player.socket === null);
  }

  // Return true if the room has been empty for the specified amount of time (or
  // longer); otherwise, return false
  isAbandoned() {
    return moment(this.lastMarkedInactive).add(Room.abandonmentThreshold).isSameOrBefore(moment());
  }
}

// The number of minutes a room can be inactive before it is considered
// abandoned (and thus subject to automatic deletion by the RoomManager)
Room.abandonmentThreshold = moment.duration(10, 'minutes');

export default Room;
