/* skillbased - UI: rendering, animations, modal, toasts, wallet button, FAQ */
import { state, RANKS, DAILIES, DAILY_MAX, GAME_CAPS, dailyStats, weeklyStats, rankFor, nextRank, shortAddr, award, setWallet } from './state.js';
import { GAME_ICONS, rankIcon } from './icons.js';

const $ = id => document.getElementById(id);

/* ---------- toasts ---------- */
export function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4200);
}

/* ---------- animated counters ---------- */
const shown = new Map();
function countUp(el, to) {
  const from = shown.get(el) || 0;
  if (from === to) { el.textContent = to.toLocaleString(); return; }
  shown.set(el, to);
  const t0 = performance.now(), dur = 700;
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- wallet (Robinhood Chain · EIP-1193) ---------- */
const CHAIN = {
  chainId: '0x1237', // 4663
  chainName: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
  blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
};
const LOGOUT_KEY = 'sb_logged_out';
const eth = () => window.ethereum;

async function ensureChain(provider) {
  const current = await provider.request({ method: 'eth_chainId' });
  if (String(current).toLowerCase() === CHAIN.chainId) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.chainId }] });
  } catch (e) {
    if (e?.code !== 4902) throw e;
    await provider.request({ method: 'wallet_addEthereumChain', params: [CHAIN] });
  }
}

async function connectWallet() {
  const provider = eth();
  if (!provider) {
    window.open('https://metamask.io/', '_blank');
    toast('No wallet found. Install MetaMask (or any EVM wallet) to connect.');
    return;
  }
  let addr;
  try {
    [addr] = await provider.request({ method: 'eth_requestAccounts' });
  } catch { return; /* user rejected */ }
  if (!addr) return;
  localStorage.removeItem(LOGOUT_KEY);
  setWallet(addr.toLowerCase());
  renderAll();
  toast(`Logged in as <b>${shortAddr()}</b>. Scores will now save.`);
  try { await ensureChain(provider); }
  catch { toast('Switch your wallet to <b>Robinhood Chain</b> to receive prizes.'); }
}

function disconnectWallet() {
  localStorage.setItem(LOGOUT_KEY, '1');
  setWallet(null);
  renderAll();
  toast('Logged out. Scores are no longer saving.');
}

export function tryAutoConnect() {
  const provider = eth();
  if (!provider) return;
  const loggedOut = () => !!localStorage.getItem(LOGOUT_KEY);
  if (!loggedOut()) {
    provider.request({ method: 'eth_accounts' })
      .then(([addr]) => { if (addr) { setWallet(addr.toLowerCase()); renderAll(); } })
      .catch(() => {});
  }
  provider.on?.('accountsChanged', ([addr]) => {
    if (loggedOut()) return;
    setWallet(addr ? addr.toLowerCase() : null);
    renderAll();
  });
}

/* ---------- rendering ---------- */
export function renderAll() {
  const rank = rankFor(state.points);

  countUp($('nav-points-value'), state.points);
  countUp($('stat-points'), state.points);
  countUp($('stat-week'), weeklyStats().pts);
  $('nav-rank-dot').style.background = rank.color;
  $('nav-rank-dot').style.color = rank.color;
  $('stat-rank').textContent = state.wallet ? rank.name : '–';
  $('stat-rank').style.color = state.wallet ? rank.color : '';

  const pill = $('nav-points');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');

  const btn = $('btn-wallet');
  if (state.wallet) {
    btn.textContent = shortAddr();
    btn.classList.add('connected');
    btn.title = 'Click to log out';
  } else {
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    btn.title = '';
  }

  renderGames();
  renderRanks();
  renderRankProgress();
  renderDailies();
}

function renderDailies() {
  const d = dailyStats();
  const w = weeklyStats();
  const pct = Math.min(100, Math.round(100 * d.earned / DAILY_MAX));
  $('dailies').innerHTML = `
    <div class="dailies-head">
      <h3>Daily quests</h3>
      <span>resets at midnight · only your best run per game banks points</span>
    </div>
    <div class="earn-meter">
      <div class="earn-meter-top">
        <span>Today <b>+${d.earned.toLocaleString()}</b> / ${DAILY_MAX.toLocaleString()} pts</span>
        <span>This week <b>+${w.pts.toLocaleString()}</b></span>
      </div>
      <div class="earn-meter-bar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="dailies-row">
      ${DAILIES.map(q => {
        const done = d.claimed.includes(q.id);
        return `
        <div class="quest${done ? ' done' : ''}">
          <span class="quest-check">${done ? '✓' : ''}</span>
          <div class="quest-body"><b>${q.name}</b><p>${q.desc}</p></div>
          <span class="quest-meta">${done ? 'claimed' : q.progress(d) + '/' + q.target}<b>+${q.pts}</b></span>
        </div>`;
      }).join('')}
    </div>
    ${state.wallet ? '' : '<div class="dailies-note">Connect your wallet to earn daily rewards.</div>'}`;
}

function renderGames() {
  $('games-grid').innerHTML = state.games.map((g, i) => `
    <button class="game-card reveal" data-game="${g.id}" style="transition-delay:${(i % 3) * 80}ms">
      <span class="game-icon">${GAME_ICONS[g.id]}</span>
      <h3>${g.name} <span class="game-cap">${GAME_CAPS[g.id]} pts/day</span></h3>
      <p>${g.desc}</p>
      <div class="game-meta">
        <span class="game-skill">${g.skill}</span>
        <span class="game-best">${state.best[g.id] ? 'best +' + state.best[g.id] : state.wallet ? 'not played' : 'guest · not saving'}</span>
      </div>
    </button>`).join('');
  observeReveals();
}

export function renderRanks() {
  const current = state.wallet ? rankFor(state.points) : null;
  $('ranks-row').innerHTML = RANKS.map((r, i) => `
    <div class="rank-card reveal${r === current ? ' current' : ''}" style="transition-delay:${i * 60}ms">
      <div class="rank-icon" style="filter:drop-shadow(0 0 14px ${r.color}88)">${rankIcon(r)}</div>
      <h3 style="color:${r.color}">${r.name}</h3>
      <span>${r.min.toLocaleString()}+ pts</span>
      <span>payout ${r.mult}</span>
      ${r === current ? '<div class="you-tag">your rank</div>' : ''}
    </div>`).join('');
  observeReveals();
}

function renderRankProgress() {
  const box = $('rank-progress');
  if (!state.wallet) {
    box.innerHTML = `
      <div class="rank-progress-top"><span>Your progress</span><b>–</b></div>
      <div class="rank-progress-bar"><div class="rank-progress-fill"></div></div>
      <div class="rank-progress-note">Connect your wallet to start tracking your rank progress.</div>`;
    return;
  }
  const cur = rankFor(state.points), next = nextRank(state.points);
  const pct = next ? Math.round(100 * (state.points - cur.min) / (next.min - cur.min)) : 100;
  box.innerHTML = `
    <div class="rank-progress-top">
      <span><b style="color:${cur.color}">${cur.name}</b> · ${state.points.toLocaleString()} pts</span>
      <b>${next ? `${(next.min - state.points).toLocaleString()} pts to ${next.name}` : 'max rank reached'}</b>
    </div>
    <div class="rank-progress-bar"><div class="rank-progress-fill" data-pct="${pct}"></div></div>
    <div class="rank-progress-note">${next ? `${pct}% of the way to ${next.name}. Payout multiplier jumps to ${next.mult}.` : 'You sit at the top of the pool.'}</div>`;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const fill = box.querySelector('.rank-progress-fill');
      if (fill) fill.style.width = Math.max(2, pct) + '%';
    }));
}

/* ---------- FAQ ---------- */
const FAQ = [
  ['What is skillbased?',
   'A browser gaming arena on Robinhood Chain. Six short games (reaction, aim, typing, sequence memory, number memory, chess) that train the reflexes and focus traders use at the screen. Your best runs bank points, points set your rank, and rank multiplies your share of the weekly <b>USDG prize pool</b>.'],
  ['What is $SKILL and how do prizes work?',
   "$SKILL is the coin behind the arena, launched on PONS. It is <b>never handed out as a reward</b>. Every $SKILL trade accrues creator fees, and those fees plus a pre-funded USDG treasury fill a weekly <b>USDG prize pool</b>. Each Monday the pool settles and splits across active players by weekly points × rank multiplier. Prizes are paid in USDG on Robinhood Chain: no emissions, no inflation, no token dumps."],
  ['Do I need to log in to play?',
   'No. Every game is free to play as a guest, but guest scores are <b>not saved</b>. Connect an EVM wallet (MetaMask or similar) to save scores, bank points, appear on the leaderboard and qualify for USDG prizes.'],
  ['How do points work?',
   "Each game turns performance into points. Reaction: (450 minus your average ms) / 2. Aim: (1400 minus ms per target) / 9. Typing: wpm × accuracy. Sequence: 15 per level. Numbers: 20 per level. Chess: a checkmate win pays by engine difficulty (Easy 100, Medium 175, Hard 250), draws score by material, losses 15. Only your <b>best run per game per day</b> banks points, capped per game (Reaction 150, Aim 150, Typing 200, Sequence 150, Numbers 150, Chess 250). Replays add only the difference over today's best. Three daily quests add +50, +75 and +100, so a perfect day banks <b>1,275 pts</b>. Weekly points reset Monday and drive prizes. Lifetime points drive your rank."],
  ['How do ranks work?',
   'Lifetime points place you in a tier: Bronze (0+), Silver (500+), Gold (1,500+), Platinum (3,500+), Diamond (7,500+), Master (15,000+). Each tier carries a payout multiplier from 1.0x up to 3.0x, applied to your weekly points at settlement. Lifetime points never reset, so rank only goes up.'],
  ['Can I play against friends?',
   'Yes. In chess, hit <b>Play a friend live</b> and send the invite link: the moment they open it you are connected peer-to-peer and moves sync in real time, with rematches swapping colors. Keep your board open until they join. In <b>Typing Test</b>, the challenge link gives your rival the exact same words and a target to beat. Friendly chess matches score no points.'],
  ['What stops people from cheating?',
   'Every run is checked against human limits. Reaction averages under 90ms, aim under 120ms per target and typing over 230 wpm are voided instantly and bank nothing. Flagged runs are pruned before weekly settlement, and confirmed cheaters are wallet-banned from the board and all future payouts.'],
];

export function renderFAQ() {
  $('faq-list').innerHTML = FAQ.map(([q, a], i) => `
    <div class="faq-item reveal" style="transition-delay:${i * 50}ms">
      <button class="faq-q">${q}<span class="chev">▼</span></button>
      <div class="faq-a"><div><p>${a}</p></div></div>
    </div>`).join('');
  $('faq-list').addEventListener('click', e => {
    const q = e.target.closest('.faq-q');
    if (q) q.parentElement.classList.toggle('open');
  });
}

/* ---------- scroll reveal ---------- */
let observer;
export function observeReveals() {
  observer ??= new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => observer.observe(el));
}

/* ---------- hero particles + card spotlight ---------- */
export function decorate() {
  const hp = $('hero-pixels');
  if (hp) hp.innerHTML = Array.from({ length: 16 }, () => {
    const left = Math.random() * 100, dur = 14 + Math.random() * 18, delay = -Math.random() * 30;
    return `<i style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
  }).join('');

  $('games-grid').addEventListener('pointermove', e => {
    const card = e.target.closest('.game-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}

/* ---------- game modal ---------- */
let activeCleanup = null;

export function openGame(id, ctx = null) {
  const g = state.games.find(x => x.id === id);
  if (!g) return;
  $('modal-title').innerHTML = `${GAME_ICONS[g.id]}<span>${g.name}</span>`;
  $('modal-best').textContent = state.best[id] ? `best +${state.best[id]} pts` : '';
  const body = $('modal-body');
  const modal = $('modal');
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));

  body.innerHTML = `
    <div class="game-loading">
      <div class="gl-px">${'<i></i>'.repeat(9)}</div>
      <span>LOADING</span>
    </div>`;
  setTimeout(() => {
    if (modal.hidden) return;
    body.innerHTML = '';
    const finish = (pts, label) => {
      if (!state.wallet) return;
      const res = award(id, pts);
      renderAll();
      if (res.gained > 0) {
        toast(`<b>+${res.gained} pts</b> banked: ${label}` + (res.prev ? ' (new daily best)' : ''));
      } else {
        toast(`Solid run. Today's best for this game is already banked (+${res.prev}).`);
      }
      res.completed.forEach(q => toast(`Daily quest complete: ${q.name} <b>+${q.pts} pts</b>`));
      $('modal-best').textContent = `best +${state.best[id]} pts`;
    };
    activeCleanup = g.render(body, finish, ctx) || null;
  }, 700);
}

export function closeGame() {
  if (activeCleanup) { activeCleanup(); activeCleanup = null; }
  const modal = $('modal');
  modal.classList.remove('open');
  setTimeout(() => { modal.hidden = true; $('modal-body').innerHTML = ''; }, 280);
}

/* Result screen - guest-aware: guests see the score but a "log in to save" CTA.
   `pts === null` means the run was voided by anti-cheat.
   `extra` is optional HTML appended below the score (e.g. a challenge-link box). */
export function showResult(container, pts, subText, onReplay, extra = '') {
  const saved = !!state.wallet;
  if (pts === null) {
    container.innerHTML = `
      <div class="game-stage result-card">
        <div class="result-pts void">RUN VOIDED</div>
        <div class="result-sub">${subText}</div>
        <div class="result-actions">
          <button class="btn btn-primary" id="replay-btn">Play again</button>
          <button class="btn btn-ghost" id="back-btn">Back to arena</button>
        </div>
      </div>`;
    container.querySelector('#replay-btn').addEventListener('click', onReplay);
    container.querySelector('#back-btn').addEventListener('click', closeGame);
    return;
  }
  container.innerHTML = `
    <div class="game-stage result-card">
      <div class="result-pts${saved ? '' : ' unsaved'}">+${pts} pts${saved ? '' : ' (not saved)'}</div>
      <div class="result-sub">${subText}</div>
      ${saved ? '' : `
        <div class="result-save-cta">
          <p>You're playing as a guest, so this score wasn't saved.</p>
          <button class="btn btn-wallet" id="result-connect">Connect wallet to save scores</button>
        </div>`}
      ${extra}
      <div class="result-actions">
        <button class="btn btn-primary" id="replay-btn">Play again</button>
        <button class="btn btn-ghost" id="back-btn">Back to arena</button>
      </div>
    </div>`;
  container.querySelector('#replay-btn').addEventListener('click', onReplay);
  container.querySelector('#back-btn').addEventListener('click', closeGame);
  container.querySelector('#result-connect')?.addEventListener('click', connectWallet);
}

/* ---------- global wiring ---------- */
export function wire() {
  $('btn-wallet').addEventListener('click', () => state.wallet ? disconnectWallet() : connectWallet());
  $('modal-close').addEventListener('click', closeGame);
  $('modal-back').addEventListener('click', closeGame);

  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeGame(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('modal').hidden) closeGame();
  });
  $('games-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-game]');
    if (card) openGame(card.dataset.game);
  });
  // any [data-copy] element copies its payload (invite links)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-copy]');
    if (!el) return;
    navigator.clipboard?.writeText(el.dataset.copy)
      .then(() => toast('Invite link copied. Send it to your rival.'))
      .catch(() => toast('Copy blocked. Select the link and copy it manually.'));
  });
}
