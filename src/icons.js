/* skillbased - hand-drawn pixel-art game icons (rendered as crisp SVG, sized by font-size). */
import { rowsToSVG } from './pixel.js';

const C = {
  v: '#22c55e', // green
  b: '#a3e635', // lime
  d: '#15803d', // deep green
  s: '#5f6f66', // slate
  l: '#9fb0a6', // light slate
  w: '#7d8f85', // pale
};

// ⚡ reaction - lightning bolt
const bolt = [
  '....vvvvv',
  '...vvvvv.',
  '..vvvvv..',
  '.vvvvv...',
  'bvvvvvvv.',
  '...vvvv..',
  '..vvvv...',
  '.vvvv....',
  'vvvvvv...',
  '..vvv....',
  '.vvv.....',
  'vvv......',
];

// 🎯 aim - ring + ticks + center dot, generated
const aim = (() => {
  const g = Array.from({ length: 11 }, () => Array(11).fill('.'));
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const dist = Math.hypot(x - 5, y - 5);
    if (dist >= 3.4 && dist <= 4.4) g[y][x] = 'v';
    if (dist <= 1.1) g[y][x] = 'b';
  }
  [[5, 0], [5, 10], [0, 5], [10, 5]].forEach(([x, y]) => { g[y][x] = 'l'; });
  return g.map(r => r.join(''));
})();

// ⌨️ typing - keyboard
const keyboard = [
  'ssssssssssssss',
  'ssssssssssssss',
  'ssvsvsvsvsvsss',
  'ssssssssssssss',
  'ssvsvsvsvsvsss',
  'ssssssssssssss',
  'ssbbbbbbbbbsss',
  'ssssssssssssss',
];

// 🧠 sequence - simon grid, some tiles lit
const sequence = [
  'vvv.sss.bbb',
  'vvv.sss.bbb',
  'vvv.sss.bbb',
  '...........',
  'sss.bbb.sss',
  'sss.bbb.sss',
  'sss.bbb.sss',
  '...........',
  'bbb.sss.vvv',
  'bbb.sss.vvv',
  'bbb.sss.vvv',
];

// 🔢 numbers - pixel "123"
const numbers = [
  '...........',
  '.v..bbb.vvv',
  'vv....b...v',
  '.v..bbb..vv',
  '.v..b.....v',
  'vvv.bbb.vvv',
  '...........',
];

// ♞ chess - knight: ears, eye, muzzle with jaw notch, neck widening into the base
const knight = [
  '...l.l......',
  '..lllll.....',
  '.lllllll....',
  '.lsllllll...',
  'llllllllll..',
  'lllllllll...',
  'lll.llllll..',
  '....llllll..',
  '....llllll..',
  '...lllllll..',
  '..llllllll..',
  '..lllllllll.',
  '.vvvvvvvvvv.',
  '.vvvvvvvvvv.',
];

const render = rows => rowsToSVG(rows, C);

export const GAME_ICONS = {
  reaction: render(bolt),
  aim: render(aim),
  typing: render(keyboard),
  sequence: render(sequence),
  numbers: render(numbers),
  chess: render(knight),
};

/* ---------- rank badges: one pixel shape per tier, tinted by tier color ---------- */
const mix = (hex, t, to) => '#' + [1, 3, 5].map(i =>
  Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to * t).toString(16).padStart(2, '0')).join('');

const medal = [ // Bronze - medal on ribbon straps
  '.dd...dd.',
  '..dd.dd..',
  '..bbbbb..',
  '.bllbbbb.',
  '.blbbbbb.',
  '.bbbbbbd.',
  '..bbbdd..',
];
const chevrons = [ // Silver - rank stripes
  'll.....ll',
  '.ll...ll.',
  '..ll.ll..',
  '...lll...',
  'bb.....bb',
  '.bb...bb.',
  '..bb.bb..',
  '...bbb...',
];
const crown = [ // Gold
  'b...b...b',
  'b...b...b',
  'bb.bbb.bb',
  'bbbbbbbbb',
  'blblblblb',
  'bbbbbbbbb',
  '.ddddddd.',
];
const gem = [ // Platinum - hex cut
  '..bbbbb..',
  '.llbbbbb.',
  'llbbbbbbd',
  'lbbbbbbdd',
  '.bbbbbdd.',
  '..bbbbb..',
];
const brilliant = [ // Diamond - brilliant cut
  '.lllllll.',
  'blbbbbblb',
  'bbbbbbbbb',
  '.bbbbbbb.',
  '..bbbbb..',
  '...bbb...',
  '....b....',
];
const star = [ // Master
  '....b....',
  '...bbb...',
  '...lbl...',
  'bbblllbbb',
  '.bbblbbb.',
  '..bbbbb..',
  '..bb.bb..',
  '.bb...bb.',
];

const RANK_SHAPES = {
  Bronze: medal, Silver: chevrons, Gold: crown,
  Platinum: gem, Diamond: brilliant, Master: star,
};

export const rankIcon = rank =>
  rowsToSVG(RANK_SHAPES[rank.name] || medal, {
    b: rank.color,
    l: mix(rank.color, 0.45, 255),
    d: mix(rank.color, 0.3, 0),
  });
