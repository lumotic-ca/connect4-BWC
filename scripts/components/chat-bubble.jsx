import m from 'mithril';
import {
  getChatAudioEnabledPreference,
  setChatAudioEnabledPreference
} from '../models/chat-preferences.js';

class ChatBubbleComponent {
  oninit({ attrs: { session } }) {
    this.session = session;
    // Whether the chat panel is expanded
    this.isOpen = false;
    // Count of messages received while the panel is collapsed
    this.unreadCount = 0;
    // Local copy of the room chat history
    this.messages = session.chatMessages ? [...session.chatMessages] : [];
    this.chatMessagesRevision = session.chatMessagesRevision || 0;
    // User must opt in before notification sounds play
    this.audioEnabled = getChatAudioEnabledPreference();
    this.notificationAudio = null;

    this.session.on('chat-message', ({ message }) => {
      this.appendMessage(message);
      if (!this.isOpen && !this.isLocalMessage(message)) {
        this.unreadCount += 1;
        this.playNotificationSound();
      }
      m.redraw();
    });
  }

  onupdate({ attrs: { session } }) {
    if ((session.chatMessagesRevision || 0) !== this.chatMessagesRevision) {
      this.hydrateMessages(session.chatMessages || []);
      this.chatMessagesRevision = session.chatMessagesRevision || 0;
    }
  }

  onremove() {
    if (this.notificationAudio) {
      this.notificationAudio.pause();
      this.notificationAudio = null;
    }
  }

  // Replace the local history when the server sends a full snapshot
  hydrateMessages(messages = []) {
    this.messages = [...messages];
    this.unreadCount = 0;
  }

  appendMessage(message) {
    if (this.messages.some((existingMessage) => existingMessage.id === message.id)) {
      return;
    }
    this.messages.push(message);
    if (this.messages.length > 500) {
      this.messages.splice(0, this.messages.length - 500);
    }
  }

  isLocalMessage(message) {
    if (message.type === 'system') {
      return false;
    }
    if (this.session.localPlayer && message.playerId === this.session.localPlayer.id) {
      return true;
    }
    if (this.session.localSpectator && message.playerId === this.session.localSpectator.id) {
      return true;
    }
    return false;
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
    }
    m.redraw();
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    setChatAudioEnabledPreference(this.audioEnabled);
    m.redraw();
  }

  setDraftMessage(inputEvent) {
    this.draftMessage = inputEvent.target.value;
    inputEvent.redraw = false;
  }

  sendMessage(submitEvent) {
    submitEvent.preventDefault();
    const text = (this.draftMessage || '').trim();
    if (!text) {
      return;
    }
    this.session.emit('send-chat-message', { text }, ({ status, message }) => {
      if (status === 'sentMessage' && message) {
        this.appendMessage(message);
        this.draftMessage = '';
        m.redraw();
      }
    });
  }

  playNotificationSound() {
    if (!this.audioEnabled) {
      return;
    }
    if (!this.notificationAudio) {
      this.notificationAudio = new Audio('/sounds/chat-notification.mp3');
      this.notificationAudio.volume = 0.35;
    }
    this.notificationAudio.currentTime = 0;
    this.notificationAudio.play().catch(() => {
      // Browsers may block autoplay until the user interacts with the page
    });
  }

  formatTimestamp(sentAt) {
    return new Date(sentAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  view() {
    return (
      <div id="chat-bubble" className={this.isOpen ? 'chat-bubble-open' : 'chat-bubble-collapsed'}>
        {this.isOpen ? (
          <section className="chat-panel" aria-label="Game chat">
            <header className="chat-panel-header">
              <h2 className="chat-panel-title">Chat</h2>
              <div className="chat-panel-actions">
                <button
                  type="button"
                  className="chat-audio-toggle"
                  aria-pressed={this.audioEnabled}
                  onclick={() => this.toggleAudio()}
                >
                  {this.audioEnabled ? 'Sound on' : 'Sound off'}
                </button>
                <button
                  type="button"
                  className="chat-close-button"
                  aria-label="Close chat"
                  onclick={() => this.togglePanel()}
                >
                  ×
                </button>
              </div>
            </header>
            <div className="chat-message-list" role="log" aria-live="polite">
              {this.messages.length === 0 ? (
                <p className="chat-empty-state">No messages yet.</p>
              ) : (
                this.messages.map((message) => (
                  <div
                    className={
                      message.type === 'system'
                        ? 'chat-message chat-message-system'
                        : 'chat-message'
                    }
                  >
                    {message.type === 'system' ? (
                      <p className="chat-message-text">{message.text}</p>
                    ) : (
                      <>
                        <p className="chat-message-meta">
                          <span className="chat-message-author">{message.playerName}</span>
                          <span className="chat-message-time">
                            {this.formatTimestamp(message.sentAt)}
                          </span>
                        </p>
                        <p className="chat-message-text">{message.text}</p>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <form className="chat-input-form" action onsubmit={(event) => this.sendMessage(event)}>
              <input
                type="text"
                className="chat-input"
                autoComplete="off"
                maxLength={500}
                placeholder="Type a message..."
                value={this.draftMessage || ''}
                oninput={(event) => this.setDraftMessage(event)}
              />
              <button type="submit" className="chat-send-button">
                Send
              </button>
            </form>
          </section>
        ) : null}
        <button
          type="button"
          className="chat-fab"
          aria-label={this.isOpen ? 'Close chat' : 'Open chat'}
          aria-expanded={this.isOpen}
          onclick={() => this.togglePanel()}
        >
          <span className="chat-fab-icon" aria-hidden="true">
            💬
          </span>
          {this.unreadCount > 0 ? (
            <span className="chat-unread-badge" aria-label={`${this.unreadCount} unread messages`}>
              {this.unreadCount > 99 ? '99+' : this.unreadCount}
            </span>
          ) : null}
        </button>
      </div>
    );
  }
}

export default ChatBubbleComponent;
