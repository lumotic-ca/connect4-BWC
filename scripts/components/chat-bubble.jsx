import clsx from 'clsx';
import m from 'mithril';

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

    this.session.on('chat-message', ({ message }) => {
      this.appendMessage(message);
      if (!this.isOpen && !this.isLocalMessage(message)) {
        this.unreadCount += 1;
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
              <button
                type="button"
                className="chat-close-button"
                aria-label="Close chat"
                onclick={() => this.togglePanel()}
              >
                ×
              </button>
            </header>
            <div className="chat-message-list" role="log" aria-live="polite">
              {this.messages.length === 0 ? (
                <p className="chat-empty-state">No messages yet.</p>
              ) : (
                this.messages.map((message) => {
                  const isLocal = this.isLocalMessage(message);
                  const isSystem = message.type === 'system';

                  return (
                    <div
                      className={clsx('chat-message-row', {
                        'chat-message-row-local': isLocal,
                        'chat-message-row-remote': !isLocal && !isSystem,
                        'chat-message-row-system': isSystem
                      })}
                    >
                      {isSystem ? (
                        <p className="chat-message-system-text">{message.text}</p>
                      ) : (
                        <div className="chat-message-bubble">
                          {!isLocal ? (
                            <p className="chat-message-author">{message.playerName}</p>
                          ) : null}
                          <p className="chat-message-text">{message.text}</p>
                          <p className="chat-message-time">
                            {this.formatTimestamp(message.sentAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
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
