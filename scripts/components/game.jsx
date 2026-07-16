import clsx from 'clsx';
import m from 'mithril';
import Game from '../models/game.js';
import ChatBubbleComponent from './chat-bubble.jsx';
import DashboardComponent from './dashboard.jsx';
import GridComponent from './grid.jsx';
import PlayerAreaComponent from './player-area.jsx';
import ReactionPickerComponent from './reaction-picker.jsx';

// The game UI, encompassing all UI pertaining to the game directly
class GameComponent {
  oninit({ attrs: { session, roomCode } }) {
    this.session = session;
    this.game = new Game({
      // Only enable debug mode during local development builds
      debug: import.meta.env.DEV
    });
    if (roomCode) {
      this.session.connect();
      this.joinRoom({ roomCode });
    }
    // When the app initializes, queue event listeners for online game events;
    // if P1 has not started an online game yet, the event listeners will be
    // queued until an online room is opened or joined (which is when the socket
    // connection is opened)
    this.listenForOnlineGameEvents({ roomCode });
    this.handlePlayerConnections({ roomCode });
  }

  joinRoom({ roomCode }) {
    // Join the room immediately if a room code is specified in the URL; the
    // room code and local player ID are implicitly and automatically passed by
    // the Session class
    this.session.emit('join-room', { roomCode }, (args) => {
      const { game, localPlayer, status } = args;
      if (game) {
        this.game.restoreFromServer({ game, localPlayer });
        if (localPlayer) {
          const otherPlayer = this.game.getOtherPlayer(localPlayer);
          if (otherPlayer && otherPlayer.connected === false) {
            this.session.disconnectedPlayer = otherPlayer;
          }
        }
      }
      if (status === 'watchingGame' && !localPlayer) {
        const spectatorId = this.session.getLocalSpectatorId();
        if (spectatorId) {
          this.registerSpectator({ spectatorId });
        } else {
          this.session.status = 'spectatorRegistration';
        }
      }
      m.redraw();
    });
  }

  registerSpectator({ name, spectatorId } = {}) {
    const payload = spectatorId ? { spectatorId } : { spectator: { name } };
    this.session.emit('register-spectator', payload, ({ game, localSpectator }) => {
      if (game) {
        this.game.restoreFromServer({ game, localPlayer: null });
      }
      if (localSpectator) {
        this.session.localSpectator = localSpectator;
      }
      this.session.status = 'watchingGame';
      m.redraw();
    });
  }

  listenForOnlineGameEvents() {
    // When P2 joins an online game, automatically update P1's screen
    this.session.on('add-player', ({ game, localPlayer, messages }) => {
      if (messages) {
        this.session.chatMessages = messages;
        this.session.chatMessagesRevision = (this.session.chatMessagesRevision || 0) + 1;
      }
      this.game.restoreFromServer({ game, localPlayer });
      m.redraw();
    });
    // If either player ends an online game early, automatically update the
    // local player's game instance and indicate who ended the game
    this.session.on('end-game', ({ requestingPlayer }) => {
      this.game.requestingPlayer = requestingPlayer;
      this.game.endGame();
      m.redraw();
    });
    this.session.on('request-new-game', ({ requestingPlayer }) => {
      this.game.requestingPlayer = requestingPlayer;
      m.redraw();
    });
    this.session.on('start-new-game', ({ game, localPlayer }) => {
      this.game.restoreFromServer({ game, localPlayer });
      m.redraw();
    });
  }

  handlePlayerConnections({ roomCode }) {
    this.session.on('player-disconnected', ({ disconnectedPlayer }) => {
      this.session.disconnectedPlayer = disconnectedPlayer;
      // Clear timer for reconnection message
      clearTimeout(this.session.reconnectMessageTimer);
      delete this.session.reconnectedPlayer;
      m.redraw();
    });
    this.session.on('player-reconnected', () => {
      if (this.session.disconnectedPlayer) {
        this.session.disconnectedPlayer.lastDisconnectReason = null;
        this.session.reconnectedPlayer = this.session.disconnectedPlayer;
        delete this.session.disconnectedPlayer;
      }
      clearTimeout(this.session.reconnectMessageTimer);
      // Display a message for a short moment indicating the other player has
      // reconnected, returning to the previous game message afterwards
      this.session.reconnectMessageTimer = setTimeout(() => {
        delete this.session.reconnectedPlayer;
        m.redraw();
      }, GameComponent.reconnectMessageDuration);
      m.redraw();
    });
    this.session.on('disconnect', () => {
      // At this point, the session object's `disconnected` flag is
      // automatically set to true
      m.redraw();
    });
    this.session.on('reconnect', () => {
      this.joinRoom({ roomCode });
    });
  }

  view({ attrs: { roomCode } }) {
    const showOnlineChat = Boolean(roomCode && this.session.connected);
    const showReactions =
      this.session.connected && this.game.players.length === 2 && this.session.localPlayer;

    return (
      <div id="game" className={clsx({ 'in-progress': this.game.inProgress })}>
        <div className="game-column">
          <h1>Connect Four</h1>
          <DashboardComponent
            game={this.game}
            session={this.session}
            roomCode={roomCode}
            onRegisterSpectator={({ name }) => this.registerSpectator({ name })}
          />
        </div>
        <div className="game-column">
          <GridComponent game={this.game} session={this.session} />
          <PlayerAreaComponent game={this.game} session={this.session} />
          {showReactions ? (
            <ReactionPickerComponent game={this.game} session={this.session} />
          ) : null}
        </div>
        {showOnlineChat ? <ChatBubbleComponent session={this.session} /> : null}
      </div>
    );
  }
}

// The duration (in ms) the 'reconnected player' message will show before the
// game message returns to the previously-shown message
GameComponent.reconnectMessageDuration = 1000;

export default GameComponent;
