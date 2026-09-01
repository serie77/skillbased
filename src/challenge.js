/* skillbased - invite links: seeded typing races and chess matches by link */
import { WORDS } from './words.js';
import { shortAddr } from './state.js';

const mulberry32 = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

export const newSeed = () => (Math.random() * 2 ** 31) | 0;

export function seededWords(seed, n = 90) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => WORDS[Math.floor(r() * WORDS.length)]);
}

const base = () => location.origin + '/app/';
const from = () => encodeURIComponent(shortAddr() || 'a rival');

export const typingLink = (seed, score, wpm) =>
  `${base()}?challenge=typing&seed=${seed}&score=${score}&wpm=${wpm}&from=${from()}`;

export const chessInvite = peerId =>
  `${base()}?match=chess&join=${encodeURIComponent(peerId)}&from=${from()}`;

export function parseInvite() {
  const p = new URLSearchParams(location.search);
  if (p.get('challenge') === 'typing') {
    return {
      game: 'typing',
      seed: parseInt(p.get('seed'), 10) || 1,
      score: parseInt(p.get('score'), 10) || 0,
      wpm: parseInt(p.get('wpm'), 10) || 0,
      from: p.get('from') || 'a rival',
    };
  }
  if (p.get('match') === 'chess' && p.get('join')) {
    return {
      game: 'chess',
      join: p.get('join'),
      from: p.get('from') || 'a rival',
    };
  }
  return null;
}

/* Shared "copy this link" box markup; wired by the [data-copy] handler in ui.js. */
export const linkBox = (label, link) => `
  <div class="link-box">
    <span>${label}</span>
    <div class="link-box-row">
      <input class="link-input" readonly value="${link.replace(/&/g, '&amp;')}" onclick="this.select()">
      <button class="btn btn-ghost btn-copy" data-copy="${link.replace(/&/g, '&amp;')}">Copy</button>
    </div>
  </div>`;
