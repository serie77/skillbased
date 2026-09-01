/* skillbased — state: points, ranks, per-wallet persistence. Scores only save when logged in. */

export const RANKS = [
  { name: 'Bronze',   min: 0,     mult: '1.0x', color: '#c07a3a' },
  { name: 'Silver',   min: 500,   mult: '1.2x', color: '#7c8a93' },
  { name: 'Gold',     min: 1500,  mult: '1.5x', color: '#d4a017' },
  { name: 'Platinum', min: 3500,  mult: '1.8x', color: '#14957f' },
  { name: 'Diamond',  min: 7500,  mult: '2.2x', color: '#2f7fe0' },
  { name: 'Master',   min: 15000, mult: '3.0x', color: '#0a5c36' },
];

export const BOTS = [
  { name: 'hoodmaxi',      pts: 18420 },
  { name: '0xJune',        pts: 12980 },
  { name: 'clipzone',      pts: 9340 },
  { name: 'wickhunter',    pts: 6210 },
  { name: 'fadegod',       pts: 4470 },
  { name: 'tapewatcher',   pts: 2890 },
  { name: 'sizequeen.eth', pts: 1660 },
  { name: 'chartmonk',     pts: 940 },
  { name: 'paperhands',    pts: 310 },
];

export const state = {
  wallet: null,
  points: 0,
  best: {},
  games: [],
};

export const rankFor = pts => {
  let r = RANKS[0];
  for (const t of RANKS) if (pts >= t.min) r = t;
  return r;
};

export const nextRank = pts => RANKS.find(r => r.min > pts) || null;

export const shortAddr = () =>
  state.wallet ? state.wallet.slice(0, 6) + '…' + state.wallet.slice(-4) : null;

const key = () => 'sb_' + state.wallet;

function load() {
  if (!state.wallet) { state.points = 0; state.best = {}; return; }
  try {
    const d = JSON.parse(localStorage.getItem(key()) || '{}');
    state.points = d.points || 0;
    state.best = d.best || {};
  } catch { state.points = 0; state.best = {}; }
}

function save() {
  if (!state.wallet) return;
  localStorage.setItem(key(), JSON.stringify({ points: state.points, best: state.best }));
}

export function setWallet(addr) {
  state.wallet = addr;
  load();
}

/* ---------- scoring economy ----------
   Only your BEST run per game per day banks points (grinding adds nothing).
   Per-game daily caps + quest bonuses give a hard daily ceiling. */
export const GAME_CAPS = { reaction: 150, aim: 150, typing: 200, sequence: 150, numbers: 150, chess: 250 };
export const DAILY_GAME_MAX = Object.values(GAME_CAPS).reduce((a, b) => a + b, 0); // 985
export const DAILY_QUEST_MAX = 225;
export const DAILY_MAX = DAILY_GAME_MAX + DAILY_QUEST_MAX; // 1,210

/* ---------- daily quests ---------- */
export const DAILIES = [
  { id: 'first', name: 'Warm-up', desc: 'Play your first game of the day', pts: 50, target: 1, progress: d => Math.min(d.plays, 1) },
  { id: 'reps',  name: 'Reps',    desc: 'Finish 3 games',                  pts: 75, target: 3, progress: d => Math.min(d.plays, 3) },
  { id: 'range', name: 'Range',   desc: 'Play 3 different games',          pts: 100, target: 3, progress: d => Math.min(d.kinds.length, 3) },
];

export function dailyStats() {
  const empty = { date: new Date().toDateString(), plays: 0, kinds: [], claimed: [], bests: {}, earned: 0 };
  if (!state.wallet) return empty;
  try {
    const d = JSON.parse(localStorage.getItem(key() + '_daily') || 'null');
    return d && d.date === empty.date ? { ...empty, ...d } : empty;
  } catch { return empty; }
}

/* Monday of the current week — the weekly ladder key. */
const weekKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.toDateString();
};

export function weeklyStats() {
  const empty = { week: weekKey(), pts: 0 };
  if (!state.wallet) return empty;
  try {
    const w = JSON.parse(localStorage.getItem(key() + '_week') || 'null');
    return w && w.week === empty.week ? w : empty;
  } catch { return empty; }
}

/* Banks a run. Only the delta over today's best for that game counts.
   Returns { gained, run, prev, completed } or null when logged out. */
export function award(gameId, pts) {
  if (!state.wallet) return null;
  const d = dailyStats();
  d.plays++;
  if (!d.kinds.includes(gameId)) d.kinds.push(gameId);

  const run = Math.min(pts, GAME_CAPS[gameId] ?? 150);
  const prev = d.bests[gameId] || 0;
  const gained = Math.max(0, run - prev);
  d.bests[gameId] = Math.max(prev, run);

  const completed = DAILIES.filter(q => !d.claimed.includes(q.id) && q.progress(d) >= q.target);
  completed.forEach(q => d.claimed.push(q.id));
  const questPts = completed.reduce((sum, q) => sum + q.pts, 0);

  d.earned += gained + questPts;
  localStorage.setItem(key() + '_daily', JSON.stringify(d));

  const w = weeklyStats();
  w.pts += gained + questPts;
  localStorage.setItem(key() + '_week', JSON.stringify(w));

  state.points += gained + questPts;
  if (pts > (state.best[gameId] || 0)) state.best[gameId] = pts; // all-time best keeps the raw run
  save();
  return { gained, run, prev, completed };
}
