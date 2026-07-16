import m from 'mithril';
import AppComponent from './components/app.jsx';
import { initTheme } from './models/theme-preferences.js';
import '../styles/index.scss';
import '@fontsource/ubuntu/400.css';

// Apply the saved theme before the first render
initTheme();

// Eliminate the #! for all routes
m.route.prefix = '';

m.route(document.querySelector('main'), '/', {
  '/': AppComponent,
  '/room/:roomCode': AppComponent
});
