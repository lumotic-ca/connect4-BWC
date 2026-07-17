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
    // Participant names currently shown as typing
    this.typingParticipants = {};
    // Whether the desktop emoji tray is visible
    this.isEmojiTrayOpen = false;
    // Debounce timer for outgoing typing notifications
    this.typingEmitTimer = null;
    this.typingStopTimer = null;

    this.session.on('chat-message', ({ message }) => {
      this.appendMessage(message);
      if (!this.isOpen && !this.isLocalMessage(message)) {
        this.unreadCount += 1;
      }
      this.queueScrollToBottom({ force: this.isLocalMessage(message) });
      m.redraw();
    });

    this.session.on('chat-typing', ({ playerId, playerName, typing }) => {
      if (this.isLocalParticipant(playerId)) {
        return;
      }
      if (typing) {
        this.typingParticipants[playerId] = playerName;
      } else {
        delete this.typingParticipants[playerId];
      }
      m.redraw();
    });
  }

  onupdate({ attrs: { session } }) {
    if ((session.chatMessagesRevision || 0) !== this.chatMessagesRevision) {
      this.hydrateMessages(session.chatMessages || []);
      this.chatMessagesRevision = session.chatMessagesRevision || 0;
      this.queueScrollToBottom({ force: true });
    }
  }

  onremove() {
    this.clearTypingTimers();
    this.emitTypingStop();
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

  isLocalParticipant(participantId) {
    if (this.session.localPlayer && this.session.localPlayer.id === participantId) {
      return true;
    }
    if (this.session.localSpectator && this.session.localSpectator.id === participantId) {
      return true;
    }
    return false;
  }

  isLocalMessage(message) {
    if (message.type === 'system') {
      return false;
    }
    return this.isLocalParticipant(message.playerId);
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
      this.queueScrollToBottom({ force: true });
    } else {
      this.isEmojiTrayOpen = false;
      this.emitTypingStop();
    }
    m.redraw();
  }

  setDraftMessage(inputEvent) {
    this.draftMessage = inputEvent.target.value;
    inputEvent.redraw = false;
    this.handleDraftInput();
  }

  handleDraftInput() {
    const hasText = Boolean((this.draftMessage || '').trim());
    if (!hasText) {
      this.emitTypingStop();
      return;
    }

    clearTimeout(this.typingStopTimer);
    if (!this.typingEmitTimer) {
      this.session.emit('chat-typing', { typing: true });
      this.typingEmitTimer = setTimeout(() => {
        this.typingEmitTimer = null;
      }, ChatBubbleComponent.typingEmitInterval);
    }

    this.typingStopTimer = setTimeout(() => {
      this.emitTypingStop();
    }, ChatBubbleComponent.typingStopDelay);
  }

  clearTypingTimers() {
    clearTimeout(this.typingEmitTimer);
    clearTimeout(this.typingStopTimer);
    this.typingEmitTimer = null;
    this.typingStopTimer = null;
  }

  emitTypingStop() {
    this.clearTypingTimers();
    this.session.emit('chat-typing', { typing: false });
  }

  sendMessage(submitEvent) {
    submitEvent.preventDefault();
    const text = (this.draftMessage || '').trim();
    if (!text) {
      return;
    }
    this.emitTypingStop();
    this.session.emit('send-chat-message', { text }, ({ status, message }) => {
      if (status === 'sentMessage' && message) {
        this.appendMessage(message);
        this.draftMessage = '';
        this.queueScrollToBottom({ force: true });
        m.redraw();
      }
    });
  }

  toggleEmojiTray() {
    this.isEmojiTrayOpen = !this.isEmojiTrayOpen;
    m.redraw();
  }

  insertEmoji(symbol) {
    const input = this.messageInputElement;
    const text = this.draftMessage || '';
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? start;
    this.draftMessage = `${text.slice(0, start)}${symbol}${text.slice(end)}`;
    this.handleDraftInput();
    m.redraw();
    requestAnimationFrame(() => {
      if (!input) {
        return;
      }
      input.focus();
      const cursor = start + symbol.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  isPinnedToBottom() {
    if (!this.messageListElement) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = this.messageListElement;
    return scrollHeight - scrollTop - clientHeight <= ChatBubbleComponent.scrollPinThreshold;
  }

  queueScrollToBottom({ force = false } = {}) {
    if (!this.isOpen) {
      return;
    }
    if (!force && !this.isPinnedToBottom()) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.messageListElement) {
          this.messageListElement.scrollTop = this.messageListElement.scrollHeight;
        }
      });
    });
  }

  formatTimestamp(sentAt) {
    return new Date(sentAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatTypingIndicator() {
    const names = Object.values(this.typingParticipants);
    if (names.length === 0) {
      return null;
    }
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    }
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)} are typing...`;
  }

  view() {
    const typingIndicator = this.formatTypingIndicator();

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
            <div
              className="chat-message-list"
              role="log"
              aria-live="polite"
              oncreate={(vnode) => {
                this.messageListElement = vnode.dom;
                this.queueScrollToBottom({ force: true });
              }}
              onupdate={() => {
                this.queueScrollToBottom();
              }}
            >
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
            {typingIndicator ? (
              <p className="chat-typing-indicator" aria-live="polite">
                {typingIndicator}
              </p>
            ) : null}
            {this.isEmojiTrayOpen ? (
              <div className="chat-emoji-tray" role="toolbar" aria-label="Emoji picker">
                {ChatBubbleComponent.chatEmojis.map((symbol) => (
                  <button
                    type="button"
                    className="chat-emoji-button"
                    aria-label={`Insert ${symbol}`}
                    onclick={() => this.insertEmoji(symbol)}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            ) : null}
            <form className="chat-input-form" action onsubmit={(event) => this.sendMessage(event)}>
              <button
                type="button"
                className="chat-emoji-toggle"
                aria-label={this.isEmojiTrayOpen ? 'Hide emoji picker' : 'Show emoji picker'}
                aria-expanded={this.isEmojiTrayOpen}
                onclick={() => this.toggleEmojiTray()}
              >
                😀
              </button>
              <input
                type="text"
                className="chat-input"
                autoComplete="off"
                maxLength={500}
                placeholder="Type a message..."
                value={this.draftMessage || ''}
                oncreate={(vnode) => {
                  this.messageInputElement = vnode.dom;
                }}
                oninput={(event) => this.setDraftMessage(event)}
                onblur={() => this.emitTypingStop()}
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

ChatBubbleComponent.chatEmojis = [
  '😀',
  '😁',
  '😂',
  '😉',
  '😮',
  '😭',
  '😬',
  '👏',
  '👍',
  '👎',
  '❤️',
  '🔥',
  '🎉',
  '☕',
  '🤔',
  '💯'
];

ChatBubbleComponent.typingEmitInterval = 2000;
ChatBubbleComponent.typingStopDelay = 2500;
ChatBubbleComponent.scrollPinThreshold = 48;

export default ChatBubbleComponent;
