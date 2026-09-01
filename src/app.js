/* skillbased - app boot: the playable arena. Wallet, points, quests, games, rank progress. */
import './style.css';
import { logoSVG, setFavicon } from './pixel.js';
import './games.js';
import './chessgame.js';
import { state } from './state.js';
import { renderAll, decorate, wire, observeReveals, tryAutoConnect, openGame } from './ui.js';
import { wireTheme } from './theme.js';
import { runSplash } from './splash.js';
import { parseInvite } from './challenge.js';

const $ = id => document.getElementById(id);

$('brand-logo').innerHTML = logoSVG(30);
setFavicon();

renderAll();
decorate();
wire();
observeReveals();
wireTheme($('theme-toggle'));
tryAutoConnect();

const openFromHash = () => {
  const id = location.hash.slice(1);
  if (id && state.games.some(g => g.id === id)) {
    history.replaceState(null, '', location.pathname);
    openGame(id);
  }
};
window.addEventListener('hashchange', openFromHash);

runSplash(() => {
  // invite link? drop straight into the challenge. Otherwise /app/#chess opens that game.
  const invite = parseInvite();
  if (invite) {
    history.replaceState(null, '', location.pathname);
    openGame(invite.game, invite);
    return;
  }
  openFromHash();
});
