/* global ga, gtag */
import m from 'mithril';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../models/room-code.js';

class DashboardControlsComponent {
  oninit({ attrs: { game, session } }) {
    this.game = game;
    this.session = session;
  }

  // Prepare game players by creating new players (if necessary) and deciding
  // which player has the starting move
  setPlayers(gameType) {
    if (this.game.players.length > 0) {
      // Reset new games before choosing number of players (no need to reset
      // the very first game)
      this.game.resetGame();
    }
    this.game.setPlayers(gameType);
  }

  startGame(newStartingPlayer) {
    this.game.startGame({
      startingPlayer: newStartingPlayer
    });
  }

  endGame(roomCode) {
    if (roomCode) {
      // The local player ID and room code will be automatically passed by the
      // session.emit() function
      this.session.emit('end-game');
    } else {
      this.game.endGame();
    }
  }

  returnToHome() {
    this.session.disconnect();
    // Redirect to homepage and clear all app state
    window.location.href = '/';
  }

  closeRoom() {
    this.session.status = 'closingRoom';
    this.session.emit('close-room', {}, () => {
      this.returnToHome();
    });
  }

  declineNewGame() {
    this.session.status = 'decliningNewGame';
    this.session.emit('decline-new-game', {}, () => {
      this.returnToHome();
    });
  }

  leaveRoom() {
    this.session.status = 'leavingRoom';
    this.returnToHome();
  }

  promptToStartOnlineGame() {
    this.session.status = 'newPlayer';
    this.setPlayers({ gameType: 'online' });
  }

  // Show the local/online choice after the user chooses a two-player game.
  promptForTwoPlayerDevice() {
    this.session.status = 'choosingTwoPlayerDevice';
  }

  // Return from the two-player device choice to the initial player-count menu.
  cancelTwoPlayerDevicePrompt() {
    this.session.status = null;
  }

  // Show the room code entry form from the home screen or device choice screen.
  promptToJoinRoomWithCode(origin) {
    this.roomCodeEntryOrigin = origin;
    delete this.roomCodeInput;
    delete this.session.roomCodeError;
    this.session.status = 'enteringRoomCode';
  }

  // Return from the room code entry form to the screen it was opened from.
  cancelRoomCodeEntry() {
    delete this.roomCodeInput;
    delete this.session.roomCodeError;
    this.session.status =
      this.roomCodeEntryOrigin === 'deviceChoice' ? 'choosingTwoPlayerDevice' : null;
  }

  setRoomCodeInput(inputEvent) {
    this.roomCodeInput = inputEvent.target.value;
    delete this.session.roomCodeError;
    inputEvent.redraw = false;
  }

  submitRoomCode(submitEvent) {
    submitEvent.preventDefault();
    const normalizedCode = normalizeRoomCode(this.roomCodeInput || '');
    if (!isValidRoomCode(normalizedCode)) {
      this.session.roomCodeError = `Enter a ${ROOM_CODE_LENGTH}-letter room code.`;
      m.redraw();
      return;
    }
    m.route.set(`/room/${normalizedCode}`);
  }

  // Start a same-device game using the original local two-human-player mode.
  startSameDeviceGame() {
    this.session.status = null;
    this.setPlayers({ gameType: '2P' });
    this.game.setStartingPlayer();
    this.startGame(this.game.startingPlayer);
  }

  setNewPlayerName(inputEvent) {
    this.newPlayerName = inputEvent.target.value.trim();
    inputEvent.redraw = false;
  }

  submitNewPlayer(submitEvent, roomCode) {
    submitEvent.preventDefault();
    if (roomCode) {
      this.addNewPlayerToGame(roomCode);
    } else {
      this.startOnlineGame();
    }
  }

  addNewPlayerToGame(roomCode) {
    this.session.status = 'connecting';
    const submittedPlayer = { name: this.newPlayerName, color: 'blue' };
    this.session.emit(
      'add-player',
      { roomCode, player: submittedPlayer },
      ({ game, localPlayer }) => {
        this.game.restoreFromServer({ game, localPlayer });
        m.redraw();
      }
    );
  }

  startOnlineGame() {
    this.session.connect();
    // Construct a placeholder player with the name we entered and the default
    // first player color
    const submittedPlayer = { name: this.newPlayerName, color: 'red' };
    // Request a new room and retrieve the room code returned from the server
    this.session.emit(
      'open-room',
      { player: submittedPlayer },
      ({ roomCode, game, localPlayer }) => {
        this.game.restoreFromServer({ game, localPlayer });
        m.route.set(`/room/${roomCode}`);
      }
    );
  }

  requestNewOnlineGame() {
    this.session.status = 'connecting';
    this.session.emit('request-new-game', { winner: this.game.winner }, ({ localPlayer }) => {
      if (this.session.status === 'requestingNewGame') {
        this.game.requestingPlayer = localPlayer;
      }
      m.redraw();
    });
  }

  // Copy text to the clipboard, using a fallback when Clipboard API is unavailable
  async copyToClipboard({ text, fallbackInputId, feedbackKey }) {
    const fallbackInput = fallbackInputId ? document.getElementById(fallbackInputId) : null;
    let copied = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // Clipboard API can fail outside secure contexts; use fallback below.
      }
    }

    if (!copied && fallbackInput) {
      fallbackInput.focus();
      fallbackInput.select();
      fallbackInput.setSelectionRange(0, text.length);
      copied = document.execCommand('copy');
    }

    if (copied) {
      this[feedbackKey] = 'Copied!';
      clearTimeout(this[`${feedbackKey}Timer`]);
      this[`${feedbackKey}Timer`] = setTimeout(() => {
        delete this[feedbackKey];
        m.redraw();
      }, DashboardControlsComponent.copyFeedbackDuration);
    }

    m.redraw();
  }

  // Copy the invite link for the host waiting screen
  copyShareLink() {
    return this.copyToClipboard({
      text: window.location.href,
      fallbackInputId: 'share-link',
      feedbackKey: 'copyFeedback'
    });
  }

  // Copy just the room code for the host waiting screen
  copyRoomCode(roomCode) {
    return this.copyToClipboard({
      text: roomCode,
      fallbackInputId: 'room-code-display',
      feedbackKey: 'copyCodeFeedback'
    });
  }

  setSpectatorName(inputEvent) {
    this.spectatorName = inputEvent.target.value.trim();
    inputEvent.redraw = false;
  }

  submitSpectatorRegistration(submitEvent) {
    submitEvent.preventDefault();
    if (this.attrs.onRegisterSpectator) {
      this.attrs.onRegisterSpectator({ name: this.spectatorName });
    }
  }

  view(vnode) {
    this.attrs = vnode.attrs;
    const { roomCode } = vnode.attrs;
    return (
      <div id="dashboard-controls">
        {this.session.status === 'spectatorRegistration' ? (
          <form action onsubmit={(submitEvent) => this.submitSpectatorRegistration(submitEvent)}>
            <input
              type="text"
              autoComplete="off"
              id="spectator-name"
              name="spectator-name"
              autoFocus
              required
              oninput={(inputEvent) => this.setSpectatorName(inputEvent)}
            />
            <button type="submit">Join as Spectator</button>
          </form>
        ) : this.session.status === 'enteringRoomCode' ? (
          <form action onsubmit={(submitEvent) => this.submitRoomCode(submitEvent)}>
            <input
              type="text"
              autoComplete="off"
              id="room-code"
              name="room-code"
              autoFocus
              required
              maxLength={ROOM_CODE_LENGTH}
              aria-invalid={this.session.roomCodeError ? 'true' : null}
              aria-describedby={this.session.roomCodeError ? 'room-code-error' : null}
              oninput={(inputEvent) => this.setRoomCodeInput(inputEvent)}
            />
            <button type="submit">Join</button>
            <button type="button" className="go-back" onclick={() => this.cancelRoomCodeEntry()}>
              Back
            </button>
          </form>
        ) : this.session.status === 'newPlayer' ? (
          <form action onsubmit={(submitEvent) => this.submitNewPlayer(submitEvent, roomCode)}>
            <input
              type="text"
              autoComplete="off"
              id="new-player-name"
              name="new-player-name"
              autoFocus
              required
              oninput={(inputEvent) => this.setNewPlayerName(inputEvent)}
            />
            <button type="submit">{roomCode ? 'Join Game' : 'Start Game'}</button>
            {!roomCode ? (
              <a className="go-back" href="/">
                Back
              </a>
            ) : null}
          </form>
        ) : this.session.status === 'waitingForPlayers' ? (
          <div id="share-controls">
            <div className="share-row">
              <input
                type="text"
                readOnly
                id="room-code-display"
                value={roomCode}
                onclick={({ target }) => target.select()}
              />
              <button type="button" id="copy-room-code" onclick={() => this.copyRoomCode(roomCode)}>
                {this.copyCodeFeedback || 'Copy code'}
              </button>
            </div>
            <div className="share-row">
              <input
                type="text"
                readOnly
                id="share-link"
                value={window.location.href}
                onclick={({ target }) => target.select()}
              />
              <button type="button" id="copy-share-link" onclick={() => this.copyShareLink()}>
                {this.copyFeedback || 'Copy'}
              </button>
            </div>
          </div>
        ) : this.game.inProgress &&
          this.session.status !== 'watchingGame' &&
          !this.session.disconnected ? (
          <button className="warn" onclick={() => this.endGame(roomCode)}>
            End Game
          </button>
        ) : !this.game.inProgress &&
          this.session.status !== 'watchingGame' &&
          !this.session.disconnected &&
          this.session.disconnectedPlayer ? (
          <button className="warn" onclick={() => this.leaveRoom()}>
            Leave Room
          </button>
        ) : this.session.status === 'roomNotFound' ? (
          <button onclick={() => this.returnToHome()}>Return to Home</button>
        ) : this.session.socket &&
          this.game.players.length === 2 &&
          this.session.status !== 'connecting' &&
          this.session.status !== 'watchingGame' &&
          !this.session.disconnectedPlayer &&
          !this.session.reconnectedPlayer &&
          !this.session.disconnected ? (
          <>
            <button
              onclick={() => this.requestNewOnlineGame()}
              disabled={this.session.status === 'requestingNewGame'}
            >
              {this.session.status === 'newGameRequested'
                ? 'Yes!'
                : this.session.status === 'requestingNewGame'
                  ? 'Pending'
                  : 'Play Again'}
            </button>
            {this.session.status !== 'requestingNewGame' ? (
              <button
                className="warn"
                onclick={() => this.declineNewGame()}
                disabled={this.session.status === 'requestingNewGame'}
              >
                {this.session.status === 'newGameRequested'
                  ? 'Nah'
                  : this.session.status !== 'requestingNewGame'
                    ? 'No Thanks'
                    : null}
              </button>
            ) : null}
          </>
        ) : !this.session.socket ? (
          this.game.type === '1P' ? (
            <>
              {this.game.players.map((player) => (
                <button onclick={() => this.startGame(player)}>{player.name}</button>
              ))}
              <a className="go-back" href="/">
                Back
              </a>
            </>
          ) : this.session.status === 'choosingTwoPlayerDevice' ? (
            <>
              <button onclick={() => this.startSameDeviceGame()}>Same device</button>
              <button onclick={() => this.promptToStartOnlineGame()}>Different device</button>
              <button onclick={() => this.promptToJoinRoomWithCode('deviceChoice')}>
                Join with code
              </button>
              <button className="go-back" onclick={() => this.cancelTwoPlayerDevicePrompt()}>
                Back
              </button>
            </>
          ) : (
            <>
              <button onclick={() => this.setPlayers({ gameType: '1P' })}>1 Player</button>
              <button onclick={() => this.promptForTwoPlayerDevice()}>2 Players</button>
              <button onclick={() => this.promptToJoinRoomWithCode('home')}>Join with code</button>
            </>
          )
        ) : null}
      </div>
    );
  }
}

// How long the copy button shows confirmation feedback
DashboardControlsComponent.copyFeedbackDuration = 2000;

export default DashboardControlsComponent;
