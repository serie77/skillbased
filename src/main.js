/* skillbased — boot: splash, logo, render, wire */
import './style.css';
import { logoSVG, setFavicon } from './pixel.js';
import { GAME_ICONS } from './icons.js';
import './games.js';
import './chessgame.js';
import { renderAll, renderFAQ, decorate, wire, observeReveals, tryAutoConnect, openGame } from './ui.js';
import { parseInvite } from './challenge.js';

const $ = id => document.getElementById(id);

// logos
$('splash-logo').innerHTML = logoSVG(120, true);
$('brand-logo').innerHTML = logoSVG(30);
$('footer-logo').innerHTML = logoSVG(22);
$('hero-art').innerHTML = GAME_ICONS.chess;
setFavicon();

// app
renderAll();
renderFAQ();
decorate();
wire();
observeReveals();
tryAutoConnect();

// splash: real font loading + a minimum dwell so the pixel logo can assemble
const TIPS = ['loading the arena…', 'warming up reflexes…', 'shuffling the deck…', 'counting pixels…'];
$('splash-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

const minDwell = new Promise(r => setTimeout(r, 1100));
const fonts = document.fonts?.ready ?? Promise.resolve();

let progress = 0;
const bar = setInterval(() => {
  progress = Math.min(92, progress + 8 + Math.random() * 14);
  $('splash-fill').style.width = progress + '%';
}, 120);

Promise.all([minDwell, fonts]).then(() => {
  clearInterval(bar);
  $('splash-fill').style.width = '100%';
  setTimeout(() => {
    $('splash').classList.add('done');
    // invite link? drop straight into the challenge
    const invite = parseInvite();
    if (invite) {
      history.replaceState(null, '', location.pathname);
      openGame(invite.game, invite);
    }
  }, 180);
});
