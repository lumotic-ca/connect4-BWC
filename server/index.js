import open from 'open';
import { Server } from 'socket.io';

import { CHAT_RATE_LIMIT_MS, createChatMessage, sanitizeChatText } from './chat.js';
import createHttpServer from './http-server.js';
import { roomManager } from './room-manager.js';

// Attach chat history to room-related socket responses
function withChatPayload(room, payload) {
  return Object.assign(payload, {
    messages: room.messages
  });
}

// Socket.IO server
async function createServer() {
  const httpServer = await createHttpServer();
  const io = new Server(httpServer);

  // A wrapper around RoomManager.getRoom() to run the given callback if the
  // specified room exists, otherwise responding with an error message if the room
  // does not exist
  function getRoom(callback) {
    return (options, fn) => {
      options.room = roomManager.getRoom(options.roomCode);
      if (options.room) {
        callback(options, fn);
      } else {
        console.log(`room ${options.roomCode} not found`);
        fn({ status: 'roomNotFound' });
      }
    };
  }

  io.on('connection', (socket) => {
    console.log(`connected: ${socket.id}`);

    // Room events

    socket.on('open-room', ({ player }, fn) => {
      console.log(`open room by player ${player.name}`);
      const room = roomManager.openRoom();
      const localPlayer = room.addPlayer({ player, socket });
      fn(
        withChatPayload(room, {
          status: 'waitingForPlayers',
          roomCode: room.code,
          game: room.game,
          localPlayer
        })
      );
    });

    socket.on(
      'join-room',
      getRoom(({ room, playerId }, fn) => {
        console.log(`join room by ${playerId}`);
        roomManager.markRoomAsActive(room);
        const reconnectingPlayer = playerId ? room.getPlayerById(playerId) : null;
        const localPlayer = room.connectPlayer({ playerId, socket });
        let status;
        if (localPlayer) {
          if (reconnectingPlayer) {
            room.addParticipantListMessage();
          }
          if (room.players.length === 1) {
            status = 'waitingForPlayers';
          } else if (room.game.pendingNewGame && localPlayer === room.game.requestingPlayer) {
            status = 'requestingNewGame';
          } else if (room.game.pendingNewGame && localPlayer !== room.game.requestingPlayer) {
            status = 'newGameRequested';
          } else {
            status = 'returningPlayer';
          }
          // If this join-room call represents a player reconnecting to the game
          // (where they were previously disconnected), inform the other player that
          // they have reconnected
          delete localPlayer.lastDisconnectReason;
          localPlayer.broadcast('player-reconnected', {
            // If the game is still pending, make sure to stay in a pending state,
            // otherwise we can clear the status message
            status: room.game.pendingNewGame ? null : 'playerReconnected'
          });
        } else if (room.players.length === 2) {
          // If both players are currently connected, all future connections
          // represent spectators
          status = 'watchingGame';
        } else {
          status = 'newPlayer';
        }
        fn(
          withChatPayload(room, {
            status,
            game: room.game,
            localPlayer
          })
        );
      })
    );

    socket.on(
      'close-room',
      getRoom(({ room }, fn) => {
        roomManager.closeRoom(room);
        fn({ status: 'closedRoom' });
      })
    );

    socket.on(
      'decline-new-game',
      getRoom(({ playerId, room }, fn) => {
        console.log(`decline new game by ${playerId}`);
        const localPlayer = room.getPlayerById(playerId);
        localPlayer.lastDisconnectReason = 'newGameDeclined';
        room.game.pendingNewGame = false;
        fn({ status: 'declinedNewGame' });
      })
    );

    socket.on(
      'add-player',
      getRoom(({ room, player }, fn) => {
        console.log(`add player to room ${room.code}`);
        const localPlayer = room.addPlayer({ player, socket });
        room.game.startGame();
        room.addParticipantListMessage();
        // Automatically update first player's screen when second player joins
        localPlayer.broadcast('add-player', {
          status: 'addedPlayer',
          game: room.game,
          messages: room.messages
        });
        fn(
          withChatPayload(room, {
            status: 'startedGame',
            game: room.game,
            localPlayer
          })
        );
      })
    );

    // Gameplay events

    socket.on(
      'align-pending-chip',
      getRoom(({ room, column }, fn) => {
        room.game.pendingChipColumn = column;
        room.game.currentPlayer.broadcast('align-pending-chip', { column });
        fn({});
      })
    );

    socket.on(
      'place-chip',
      getRoom(({ room, column }, fn) => {
        console.log(`place chip ${room.code}`);
        if (column !== null) {
          room.game.placeChip({ column });
          // After placeChip() is called, the turn ends for the player who placed
          // the chip, making the other player the new current player
          column = room.game.grid.lastPlacedChip.column;
          if (room.game.currentPlayer && room.game.currentPlayer.socket) {
            console.log('receive next move');
            room.game.currentPlayer.socket.emit('receive-next-move', { column });
          } else {
            console.log('did not receive next move');
            console.log('current player:', room.game.currentPlayer);
          }
        }
        fn({ status: 'placedChip', column });
      })
    );

    // Game management events

    socket.on(
      'end-game',
      getRoom(({ playerId, room }, fn) => {
        console.log('end game', playerId);
        room.game.endGame();
        const localPlayer = room.getPlayerById(playerId);
        room.game.requestingPlayer = localPlayer;
        room.broadcast('end-game', {
          status: 'endedGame',
          requestingPlayer: room.game.requestingPlayer
        });
        fn({
          status: 'endedGame',
          requestingPlayer: localPlayer
        });
      })
    );

    socket.on(
      'request-new-game',
      getRoom(({ playerId, room, winner }, fn) => {
        console.log('request new game', playerId);
        const localPlayer = room.getPlayerById(playerId);
        localPlayer.lastSubmittedWinner = winner;
        // When either player requests to start a new game, each player must
        // submit the winner for that game, if any; this is because the logic
        // which analyzes the grid for a winner is client-side, at least for now;
        // to accomplish this, each player's submitted winner will be stored on
        // the respective player object;
        const submittedWinners = room.players.map((player) => player.lastSubmittedWinner);
        // If the local player is the first to request a new game, ask the other
        // player if they'd like to start a new game
        if (!room.game.pendingNewGame) {
          room.game.requestingPlayer = localPlayer;
          room.game.pendingNewGame = true;
          localPlayer.broadcast('request-new-game', {
            status: 'newGameRequested',
            requestingPlayer: room.game.requestingPlayer
          });
          // Inform the local player (who requested the new game) that their
          // request is pending
          fn({ status: 'requestingNewGame', localPlayer });
        } else if (submittedWinners.length === 2 && localPlayer !== room.game.requestingPlayer) {
          // If the other player accepts the original request to play again, start
          // a new game and broadcast the new game state to both players
          room.game.declareWinner();
          room.game.resetGame();
          room.game.startGame();
          room.broadcast('start-new-game', {
            status: 'startedGame',
            game: room.game
          });
          fn({ status: 'startedGame', localPlayer });
        }
      })
    );

    // Reaction events

    socket.on(
      'send-reaction',
      getRoom(({ playerId, room, reaction }, fn) => {
        const localPlayer = room.getPlayerById(playerId);
        localPlayer.lastReaction = reaction;
        room.broadcast('send-reaction', { reaction, reactingPlayer: localPlayer });
        fn({});
      })
    );

    // Chat events

    socket.on(
      'register-spectator',
      getRoom(({ room, spectator, spectatorId }, fn) => {
        let localSpectator = null;
        if (spectatorId) {
          localSpectator = room.connectSpectator({ spectatorId, socket });
        }
        if (!localSpectator && spectator?.name) {
          localSpectator = room.addSpectator({ spectator, socket });
        }
        if (!localSpectator) {
          fn({ status: 'spectatorNotRegistered' });
          return;
        }
        room.addParticipantListMessage();
        fn(
          withChatPayload(room, {
            status: 'watchingGame',
            game: room.game,
            localSpectator
          })
        );
      })
    );

    socket.on(
      'send-chat-message',
      getRoom(({ playerId, spectatorId, room, text }, fn) => {
        const sanitizedText = sanitizeChatText(text);
        if (!sanitizedText) {
          fn({ status: 'emptyMessage' });
          return;
        }

        const lastMessageAt = room.lastChatMessageAtBySocketId[socket.id] || 0;
        if (Date.now() - lastMessageAt < CHAT_RATE_LIMIT_MS) {
          fn({ status: 'rateLimited' });
          return;
        }
        room.lastChatMessageAtBySocketId[socket.id] = Date.now();

        let senderName;
        let senderId;
        if (playerId) {
          const localPlayer = room.getPlayerById(playerId);
          if (!localPlayer) {
            fn({ status: 'notInRoom' });
            return;
          }
          senderName = localPlayer.name;
          senderId = localPlayer.id;
        } else if (spectatorId) {
          const localSpectator = room.getSpectatorById(spectatorId);
          if (!localSpectator) {
            fn({ status: 'notInRoom' });
            return;
          }
          senderName = localSpectator.name;
          senderId = localSpectator.id;
        } else {
          fn({ status: 'notInRoom' });
          return;
        }

        const message = createChatMessage({
          playerId: senderId,
          playerName: senderName,
          text: sanitizedText
        });
        room.addMessage(message);
        room.broadcastToAll('chat-message', { message }, { excludeSocket: socket });
        fn({ status: 'sentMessage', message });
      })
    );

    socket.on('disconnect', () => {
      console.log(`disconnected: ${socket.id}`);
      if (socket.room) {
        delete socket.room.lastChatMessageAtBySocketId[socket.id];
      }
      // Indicate that this player is now disconnected
      if (socket.player) {
        console.log('unset player socket');
        socket.player.broadcast('player-disconnected', {
          disconnectedPlayer: socket.player
        });
        socket.player.socket = null;
      } else if (socket.spectator) {
        socket.spectator.socket = null;
      }
      // As soon as both players disconnect from the room (making it completely
      // empty), mark the room for deletion
      if (socket.room && !socket.room.isEmpty()) {
        roomManager.markRoomAsInactive(socket.room);
      }
    });
  });

  // Allow us to open browser
  if (process.argv.includes('--open') || process.argv.includes('-o')) {
    await open(`http://localhost:${httpServer.address().port}`);
  }
}
createServer();
