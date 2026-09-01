/* skillbased - homepage boot: marketing page only, no user data. The arena lives at /app/. */
import './style.css';
import { logoSVG, setFavicon } from './pixel.js';
import { GAME_ICONS, rankIcon } from './icons.js';
import { RANKS, DAILIES, GAME_CAPS } from './state.js';
import { renderFAQ, renderRanks, decorate, observeReveals, toast } from './ui.js';
import { wireTheme } from './theme.js';
import { runSplash } from './splash.js';

const $ = id => document.getElementById(id);

/* $SKILL contract address. Empty until launch. */
const CONTRACT_ADDRESS = '';

/* Static game showcase (the playable versions register themselves inside the app). */
const GAMES = [
  { id: 'reaction', name: 'Reaction Time',   skill: 'mechanics · speed',     desc: 'Wait for green, click as fast as you can. 5 rounds, average counts.' },
  { id: 'aim',      name: 'Aim Trainer',     skill: 'mechanics · precision', desc: 'Hit 15 targets as fast as possible. Speed and precision under pressure.' },
  { id: 'typing',   name: 'Typing Test',     skill: 'mechanics · execution', desc: '30 seconds, as many words as you can. Race friends with invite links.' },
  { id: 'sequence', name: 'Sequence Memory', skill: 'mentality · memory',    desc: 'Watch the pattern, repeat it back. One tile longer every level.' },
  { id: 'numbers',  name: 'Number Memory',   skill: 'mentality · focus',     desc: "A number flashes, then it's gone. Type it back. Digits grow each level." },
  { id: 'chess',    name: 'Chess',           skill: 'mentality · strategy',  desc: 'Beat the engine on three difficulties, or play a friend live by invite link.' },
];

/* Ladder demo: one sample player per tier, showing how weekly pts × multiplier sets the share. */
const LADDER_SAMPLE = { Master: 2400, Diamond: 2900, Gold: 3100, Silver: 1800, Bronze: 900 };

function renderLadderDemo() {
  const rows = RANKS.filter(r => LADDER_SAMPLE[r.name]).reverse().map(r => {
    const pts = LADDER_SAMPLE[r.name], mult = parseFloat(r.mult);
    return { r, pts, mult, weight: pts * mult };
  });
  const total = rows.reduce((a, x) => a + x.weight, 0);
  $('ladder-demo').innerHTML = rows.map((x, i) => {
    const share = 100 * x.weight / total;
    return `
      <div class="ld-row" style="transition-delay:${i * 90}ms">
        <span class="ld-icon">${rankIcon(x.r)}</span>
        <span class="ld-tier"><b style="color:${x.r.color}">${x.r.name}</b><span>${x.pts.toLocaleString()} wk pts × ${x.r.mult}</span></span>
        <span class="ld-bar"><i style="--w:${share.toFixed(1)}%;transition-delay:${200 + i * 120}ms"></i></span>
        <span class="ld-share">${share.toFixed(0)}%</span>
      </div>`;
  }).join('');
}

function renderQuests() {
  $('quests-demo').innerHTML = DAILIES.map(q => `
    <div class="quest">
      <div class="quest-body"><b>${q.name}</b><p>${q.desc}</p></div>
      <span class="quest-meta"><b>+${q.pts}</b></span>
    </div>`).join('');
}

function renderGames() {
  $('games-grid').innerHTML = GAMES.map((g, i) => `
    <a class="game-card reveal" href="/app/#${g.id}" style="transition-delay:${(i % 3) * 80}ms">
      <span class="game-icon">${GAME_ICONS[g.id]}</span>
      <h3>${g.name} <span class="game-cap">${GAME_CAPS[g.id]} pts/day</span></h3>
      <p>${g.desc}</p>
      <div class="game-meta">
        <span class="game-skill">${g.skill}</span>
        <span class="game-best">play →</span>
      </div>
    </a>`).join('');
}

// logos
$('brand-logo').innerHTML = logoSVG(30);
$('footer-logo').innerHTML = logoSVG(22);
$('hero-art').innerHTML = GAME_ICONS.chess;
$('coin-logo').innerHTML = logoSVG(120);
setFavicon();

// page
renderLadderDemo();
renderQuests();
renderGames();
renderRanks();
renderFAQ();
decorate();
observeReveals();
wireTheme($('theme-toggle'));

$('ca-addr').textContent = CONTRACT_ADDRESS;
$('ca-pill').addEventListener('click', () => {
  if (!CONTRACT_ADDRESS) return toast('Contract address drops at launch.');
  navigator.clipboard?.writeText(CONTRACT_ADDRESS)
    .then(() => toast('Contract address copied.'))
    .catch(() => {});
});

runSplash();
