import m from 'mithril';
import Session from '../models/session.js';
import { isDarkMode, toggleTheme } from '../models/theme-preferences.js';
import GameComponent from './game.jsx';
import UpdateNotificationComponent from './update-notification.jsx';

class AppComponent {
  oninit({ attrs = { roomCode: null } }) {
    this.session = new Session({
      url: window.location.origin,
      roomCode: attrs.roomCode
    });
    // Track theme locally so the toggle icon updates without a refresh
    this.isDark = isDarkMode();
  }

  handleThemeToggle() {
    toggleTheme();
    this.isDark = isDarkMode();
    m.redraw();
  }

  view({ attrs = { roomCode: null } }) {
    return (
      <div id="app">
        {/* The UpdateNotificationComponent manages its own visibility */}
        <UpdateNotificationComponent />
        <button
          type="button"
          id="theme-toggle"
          className="nav-link nav-link-left theme-toggle"
          aria-label={this.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onclick={() => this.handleThemeToggle()}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            {this.isDark ? '☀️' : '🌙'}
          </span>
        </button>
        <span id="personal-site-link" className="nav-link nav-link-right">
          <a href="https://github.com/lumotic-ca">Built with Cory</a>
        </span>
        <GameComponent session={this.session} roomCode={attrs.roomCode} />
      </div>
    );
  }
}

export default AppComponent;
