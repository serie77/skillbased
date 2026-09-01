/* Splash screen: real font loading plus a minimum dwell so the pixel logo can assemble. */
import { logoSVG } from './pixel.js';

const $ = id => document.getElementById(id);
const TIPS = ['loading the arena…', 'warming up reflexes…', 'shuffling the deck…', 'counting pixels…'];

export function runSplash(onDone) {
  $('splash-logo').innerHTML = logoSVG(120, true);
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
      onDone?.();
    }, 180);
  });
}
