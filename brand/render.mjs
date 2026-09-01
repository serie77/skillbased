/* Brand image generator: builds each graphic as HTML (using the site's own pixel logo + icons)
   and screenshots it with headless Edge/Chrome.  Run: node brand/render.mjs */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { logoSVG } from '../src/pixel.js';
import { GAME_ICONS } from '../src/icons.js';

const OUT = 'brand', TMP = 'brand/.tmp';
mkdirSync(TMP, { recursive: true });

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const browser = BROWSERS.find(existsSync);
if (!browser) throw new Error('no chrome/edge found');

const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&display=block';

const base = (w, h, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8">
<link href="${FONTS}" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    position: relative; font-family: "Inter", system-ui, sans-serif; color: #0f1f17;
    background:
      radial-gradient(900px 520px at 50% -10%, rgba(163,230,53,.35), transparent 65%),
      radial-gradient(700px 500px at 100% 100%, rgba(22,163,74,.12), transparent 60%),
      #f5f8f4;
  }
  .head { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700; letter-spacing: -0.04em; line-height: 0.95; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.22em; text-transform: uppercase; }
  .grad {
    background: linear-gradient(120deg, #16a34a 10%, #65a30d 45%, #15803d 80%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .arches { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); display: flex; gap: 22px; opacity: .55; }
  .arches i { display: block; width: 76px; height: 200px; border-radius: 40px 40px 0 0; background: linear-gradient(180deg, rgba(22,163,74,.10), rgba(22,163,74,0)); }
  .px { position: absolute; width: 8px; height: 8px; background: #16a34a; opacity: .22; }
  .px.l { background: #a3e635; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .foot { position: absolute; left: 0; right: 0; bottom: 34px; text-align: center; font-size: 15px; color: #5b6b61; }
  .foot b { color: #16a34a; font-weight: 600; }
  .badge {
    display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px 10px 12px; border-radius: 999px;
    background: #fff; border: 1px solid rgba(16,48,28,.12); box-shadow: 0 10px 30px rgba(15,31,23,.08);
    font-size: 15px; color: #5b6b61;
  }
  .badge img { width: 28px; height: 28px; border-radius: 8px; }
  .badge img + img { margin-left: -6px; }
  .badge b { color: #16a34a; }
  .logo svg { display: block; }
  ${extraCss}
</style></head><body>${body}</body></html>`;

const arches = `<div class="arches">${'<i></i>'.repeat(9)}</div>`;
const pixels = (n, w, h, seed = 1) => {
  let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => `<span class="px${r() > .5 ? ' l' : ''}" style="left:${(r() * w) | 0}px;top:${(r() * h) | 0}px;width:${r() > .6 ? 5 : 8}px;height:${r() > .6 ? 5 : 8}px"></span>`).join('');
};
const badge = `<div class="badge"><img src="../../public/pons.png"><img src="../../public/robinhood-chain.png"><span>Launched on <b>PONS</b> · Robinhood Chain</span></div>`;
const wordmark = size => `<div class="head" style="font-size:${size}px"><span style="color:#0f1f17">skill</span><span class="grad">based</span></div>`;

const pages = {
  'twitter-pfp': [1000, 1000, `
    <div class="center" style="background:radial-gradient(520px 520px at 50% 50%, rgba(163,230,53,.45), transparent 70%)">
      <div class="logo">${logoSVG(640)}</div>
    </div>`],

  'twitter-banner': [1500, 500, `
    ${pixels(10, 1500, 500, 7)}
    <div style="position:absolute;left:150px;top:140px;display:flex;align-items:center;gap:56px">
      <div class="logo">${logoSVG(200)}</div>
      <div>
        ${wordmark(120)}
        <div class="mono" style="font-size:18px;color:#5b6b61;margin-top:26px">The gaming arena on Robinhood Chain</div>
      </div>
    </div>
    <div style="position:absolute;right:-10px;top:-40px;font-size:560px;line-height:0;opacity:.10;transform:rotate(9deg)">${GAME_ICONS.chess}</div>
    <img src="../../public/robinhood-chain.png" style="position:absolute;right:56px;bottom:44px;width:48px;height:48px;border-radius:12px">`],

  'welcome': [1600, 900, `
    ${arches}${pixels(14, 1600, 900, 3)}
    <div class="center" style="gap:0">
      <div class="logo" style="margin-bottom:34px">${logoSVG(190)}</div>
      <div class="mono" style="font-size:20px;color:#5b6b61;margin-bottom:22px">Welcome to</div>
      ${wordmark(150)}
      <div class="mono" style="font-size:22px;color:#16a34a;margin-top:32px">The gaming arena on Robinhood Chain</div>
      <div style="display:flex;gap:74px;margin-top:80px;font-size:90px;line-height:0">
        ${['reaction', 'aim', 'typing', 'sequence', 'numbers', 'chess'].map(k => GAME_ICONS[k]).join('')}
      </div>
    </div>
    <div class="foot mono" style="font-size:14px;letter-spacing:.12em">six games · daily quests · weekly USDG prizes — <b>@skillbasedarena</b></div>`],

  'tweet-arena': [1600, 900, `
    ${arches}${pixels(14, 1600, 900, 11)}
    <div style="position:absolute;left:190px;top:330px;font-size:330px;line-height:0;transform:rotate(-12deg)">${logoSVG(330)}</div>
    <div style="position:absolute;right:150px;top:230px;font-size:360px;line-height:0;transform:rotate(9deg)">${GAME_ICONS.chess}</div>
    <div class="center" style="padding-bottom:40px">
      <div class="head" style="font-size:150px">The arena</div>
      <div class="head grad" style="font-size:150px">is open.</div>
      <div class="mono" style="font-size:20px;color:#5b6b61;margin-top:38px">Skill pays · Weekly USDG prizes</div>
      <div style="margin-top:34px">${badge}</div>
    </div>
    <div class="foot mono" style="font-size:14px;letter-spacing:.12em"><b>@skillbasedarena</b> — the gaming arena on Robinhood Chain</div>`],

  'end-of-thread': [1600, 900, `
    ${arches}${pixels(10, 1600, 900, 5)}
    <div style="position:absolute;left:48px;top:44px" class="logo">${logoSVG(64)}</div>
    <div class="center">
      <div style="font-size:150px;line-height:0;margin-bottom:60px">${warnSVG()}</div>
      <div class="head" style="font-size:150px"><span style="color:#0f1f17">End of </span><span style="background:linear-gradient(120deg,#dc2626,#b91c1c);-webkit-background-clip:text;background-clip:text;color:transparent">thread.</span></div>
      <div class="mono" style="font-size:26px;color:#dc2626;margin-top:44px">Anything below this point is a scam</div>
    </div>
    <div style="position:absolute;left:52px;bottom:44px;font-family:'JetBrains Mono',monospace;font-size:17px;color:#5b6b61;line-height:1.9">
      we will <b style="color:#0f1f17">never DM you first</b><br>real information comes from <b style="color:#0f1f17">this account only</b>
    </div>
    <div style="position:absolute;right:52px;bottom:48px;font-family:'JetBrains Mono',monospace;font-size:17px;color:#16a34a;letter-spacing:.1em">@skillbasedarena</div>`],
};

function warnSVG() {
  const rows = [
    '.......##.......', '.......##.......', '......####......', '......####......', '.....##..##.....', '.....##..##.....',
    '....##.##.##....', '....##.##.##....', '...##..##..##...', '...##..##..##...', '..##........##..', '..##...##...##..',
    '.##....##....##.', '.##..........##.', '################', '################',
  ];
  let r = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') r += `<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="#dc2626"/>`; }));
  return `<svg viewBox="0 0 160 160" width="1em" height="1em" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
}

for (const [name, [w, h, body, css]] of Object.entries(pages)) {
  const file = `${TMP}/${name}.html`;
  writeFileSync(file, base(w, h, body, css));
  const out = `${OUT}/${name}.png`;
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, `--screenshot=${process.cwd()}/${out}`, '--virtual-time-budget=8000',
    `file:///${process.cwd().replace(/\\/g, '/')}/${file}`,
  ], { stdio: 'ignore' });
  console.log('wrote', out);
}
