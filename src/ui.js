/* skillbased — UI: rendering, animations, modal, toasts, wallet button, FAQ */
import { state, RANKS, BOTS, DAILIES, DAILY_MAX, dailyStats, weeklyStats, rankFor, nextRank, shortAddr, award, setWallet } from './state.js';
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
    toast('No wallet found — install MetaMask (or any EVM wallet) to connect.');
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
  toast(`Logged in as <b>${shortAddr()}</b> — scores will now save.`);
  try { await ensureChain(provider); }
  catch { toast('Switch your wallet to <b>Robinhood Chain</b> to receive prizes.'); }
}

function disconnectWallet() {
  localStorage.setItem(LOGOUT_KEY, '1');
  setWallet(null);
  renderAll();
  toast('Logged out — scores no longer saving.');
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
  $('nav-rank-dot').style.background = rank.color;
  $('nav-rank-dot').style.color = rank.color;
  $('stat-rank').textContent = state.wallet ? rank.name : '—';
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

  renderLeaderboard();
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

function renderLeaderboard() {
  const entries = [...BOTS];
  if (state.wallet) entries.push({ name: shortAddr(), pts: state.points, you: true });
  const rows = entries.sort((a, b) => b.pts - a.pts);
  const youPos = rows.findIndex(r => r.you) + 1;

  $('lb-list').innerHTML = rows.slice(0, 8).map((r, i) => {
    const rank = rankFor(r.pts);
    return `<li class="lb-row${r.you ? ' is-you' : ''}"${r.you ? '' : ' title="Mock ranking — seeded until enough players are climbing the board"'} style="animation-delay:${i * 60}ms">
      <span class="lb-pos">#${i + 1}</span>
      <span class="lb-name">${r.name}${r.you ? ' (you)' : ''}</span>
      <span class="lb-rankicon" data-rank="${rank.name}">${rankIcon(rank)}</span>
      <span class="lb-pts">${r.pts.toLocaleString()}</span>
    </li>`;
  }).join('');

  $('lb-you').textContent = !state.wallet
    ? 'Connect your wallet to join the board and save your scores.'
    : youPos && youPos <= 8 ? "You're on the board — keep climbing."
    : `You're #${youPos} — play daily to break into the top 8.`;
}

function renderGames() {
  $('games-grid').innerHTML = state.games.map((g, i) => `
    <button class="game-card reveal" data-game="${g.id}" style="transition-delay:${(i % 3) * 80}ms">
      <span class="game-icon">${GAME_ICONS[g.id]}</span>
      <h3>${g.name}</h3>
      <p>${g.desc}</p>
      <div class="game-meta">
        <span class="game-skill">${g.skill}</span>
        <span class="game-best">${state.best[g.id] ? 'best +' + state.best[g.id] : state.wallet ? 'not played' : 'login to save'}</span>
      </div>
    </button>`).join('');
  observeReveals();
}

function renderRanks() {
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
      <div class="rank-progress-top"><span>Your progress</span><b>—</b></div>
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
    <div class="rank-progress-note">${next ? `${pct}% of the way to ${next.name} — payout multiplier jumps to ${next.mult}.` : 'You sit at the top of the pool.'}</div>`;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const fill = box.querySelector('.rank-progress-fill');
      if (fill) fill.style.width = Math.max(2, pct) + '%';
    }));
}

/* ---------- FAQ ---------- */
const FAQ = [
  ['What is skillbased?',
   'The gaming arena on Robinhood Chain. Six short games — reaction, aim, typing, sequence memory, number memory, and chess — that sharpen the mechanics and mentality traders actually use at the screen. Scores become points, points become rank, rank becomes <b>USDG prizes</b>.'],
  ['What is $SKILL and how do prizes work?',
   "$SKILL is the coin that powers the arena — it is <b>never handed out as a reward</b>. Every $SKILL trade accrues creator fees on Robinhood Chain, and those fees plus a pre-funded USDG treasury fund a weekly <b>USDG prize pool</b>. Each Monday the pool settles and splits across active members by weekly points × rank multiplier. Prizes are paid in USDG on Robinhood Chain: no emissions, no inflation, no token dumps."],
  ['Do I need to log in to play?',
   'No — every game is free to play as a guest. But guest scores are <b>not saved</b>. Connect your wallet to save scores, earn points, appear on the leaderboard, and qualify for USDG prizes.'],
  ['How do points work?',
   "Each game scores off performance — faster reactions, higher WPM, deeper memory levels, chess results. But only your <b>best run per game per day</b> banks points: replays only add the difference over today's best, so grinding adds nothing. Per-game daily caps plus quest bonuses (+50 first game, +75 for three games, +100 for three different games) put the daily ceiling at <b>1,275 pts</b>. Weekly points reset Monday and drive USDG prizes; lifetime points drive your rank."],
  ['How do ranks work?',
   'Total points place you in a tier: Bronze (0+), Silver (500+), Gold (1,500+), Platinum (3,500+), Diamond (7,500+), Master (15,000+). Each tier carries a payout multiplier from 1.0x up to 3.0x. Seasons reset periodically so the ladder stays alive.'],
  ['Can I play against friends?',
   'Yes. <b>Typing Test</b> and <b>Chess</b> both support invite links. After a typing run, copy the challenge link — your rival gets the exact same words and a target to beat. In chess, hit <b>Invite a friend</b> to start a match by link: each move generates a reply link you send back and forth until someone gets mated.'],
  ['What stops people from cheating?',
   'Scores are validated for humanly-possible ranges, and suspicious runs are pruned before weekly settlement. Payouts go to consistent, plausible play — not to whoever scripts the fastest clicker.'],
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
  $('hero-pixels').innerHTML = Array.from({ length: 16 }, () => {
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
        toast(`<b>+${res.gained} pts</b> banked — ${label}` + (res.prev ? ' (new daily best)' : ''));
      } else {
        toast(`Solid run — today's best for this game is already banked (+${res.prev}).`);
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

/* Result screen — guest-aware: guests see the score but a "log in to save" CTA.
   `pts === null` means the run was voided by anti-cheat.
   `extra` is optional HTML appended below the score (e.g. a challenge-link box). */
export function showResult(container, pts, subText, onReplay, extra = '') {
  const saved = !!state.wallet;
  if (pts === null) {
    container.innerHTML = `
      <div class="game-stage result-card">
        <div class="result-pts void">RUN VOIDED</div>
        <div class="result-sub">${subText}</div>
        <button class="btn btn-primary" id="replay-btn" style="margin-top:12px">Play again</button>
      </div>`;
    container.querySelector('#replay-btn').addEventListener('click', onReplay);
    return;
  }
  container.innerHTML = `
    <div class="game-stage result-card">
      <div class="result-pts${saved ? '' : ' unsaved'}">+${pts} pts${saved ? '' : ' (not saved)'}</div>
      <div class="result-sub">${subText}</div>
      ${saved ? '' : `
        <div class="result-save-cta">
          <p>You're playing as a guest — this score wasn't saved.</p>
          <button class="btn btn-wallet" id="result-connect">Connect wallet to save scores</button>
        </div>`}
      ${extra}
      <button class="btn btn-primary" id="replay-btn" style="margin-top:12px">Play again</button>
    </div>`;
  container.querySelector('#replay-btn').addEventListener('click', onReplay);
  container.querySelector('#result-connect')?.addEventListener('click', connectWallet);
}

/* ---------- global wiring ---------- */
export function wire() {
  $('btn-wallet').addEventListener('click', () => state.wallet ? disconnectWallet() : connectWallet());
  $('modal-close').addEventListener('click', closeGame);
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
      .then(() => toast('Invite link copied — send it to your rival.'))
      .catch(() => toast('Copy blocked — select the link and copy it manually.'));
  });
}
