import m from 'mithril';
import Session from '../models/session.js';
import GameComponent from './game.jsx';
import UpdateNotificationComponent from './update-notification.jsx';

class AppComponent {
  oninit({ attrs = { roomCode: null } }) {
    this.session = new Session({
      url: window.location.origin,
      roomCode: attrs.roomCode
    });
  }

  view({ attrs = { roomCode: null } }) {
    return (
      <div id="app">
        {/* The UpdateNotificationComponent manages its own visibility */}
        <UpdateNotificationComponent />
        <span id="personal-site-link" className="nav-link nav-link-left">
          <a href="https://github.com/lumotic-ca/connect4-BWC">View on GitHub</a>
        </span>
        <span id="github-link" className="nav-link nav-link-right">
          <a href="https://github.com/lumotic-ca">Built with Cory</a>
        </span>
        <GameComponent session={this.session} roomCode={attrs.roomCode} />
      </div>
    );
  }
}

export default AppComponent;
