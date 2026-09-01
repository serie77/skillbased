/* E2E: engine chess + difficulty, LIVE peer-to-peer chess between two tabs, typing challenge.
   Run: npm run build && npx vite preview --port 4173  (in another terminal), then: npm run test:e2e
   The live-match tests need internet (PeerJS public signaling broker). */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const BASE = 'http://localhost:4173';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  protocolTimeout: 20000,
});
const health = async (page, tag) => {
  try { await page.evaluate(() => 1); console.log(tag + ': responsive'); }
  catch { console.log(tag + ': FROZEN'); }
};
const errors = [];
const newPage = async () => {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('peerjs')) errors.push('console: ' + m.text()); });
  return p;
};
process.on('unhandledRejection', e => { console.log('FAILED:', e.message); if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); });

const A = await newPage();
const gotoApp = async (page, url) => {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.splash.done', { timeout: 20000 });
};
const status = page => page.$eval('#cs', el => el.textContent);
const clickSq = async (page, s, tag) => {
  await page.$eval(`[data-sq="${s}"]`, el => el.click());
  console.log(`   ${tag || ''} clicked ${s}`);
};

// ---------- 1. engine game + difficulty pills + plates ----------
await gotoApp(A, BASE + '/app/#chess');
await A.waitForSelector('#cb .sq', { timeout: 10000 });
assert(await A.$('#c-diff'), 'difficulty selector missing');
assert((await A.$eval('#plate-top b', el => el.textContent)).includes('Engine'), 'engine plate missing');
assert((await A.$eval('#plate-bottom b', el => el.textContent)).includes('you'), 'player plate missing');
await A.click('[data-diff="hard"]');
await A.waitForSelector('[data-diff="hard"].active', { timeout: 5000 });
await A.click('[data-sq="e2"]'); await A.click('[data-sq="e4"]');
await A.waitForFunction(() => /Your move|Check/.test(document.querySelector('#cs').textContent), { timeout: 8000 });
console.log('1. engine game, hard difficulty, plates: ok');

await A.click('[data-diff="medium"]');
await A.waitForSelector('[data-diff="medium"].active', { timeout: 5000 });
assert((await A.$eval('#plate-top b', el => el.textContent)).includes('Medium'), 'plate did not follow difficulty');
console.log('2. difficulty switch restarts with updated plate: ok');

// ---------- 2. LIVE match: two tabs, real-time sync ----------
await A.$eval('#c-invite', el => el.click());
await A.waitForSelector('.link-input', { timeout: 30000 }); // PeerJS broker handshake
const invite = await A.$eval('.link-input', el => el.value);
assert(invite.includes('match=chess&join='), 'invite link malformed: ' + invite);
console.log('3. live invite created: ok');

const B = await newPage();
await gotoApp(B, invite);
await A.waitForSelector('#plate-top', { timeout: 30000 });
await B.waitForSelector('#plate-top', { timeout: 30000 });
assert((await status(A)).includes('Your move'), 'host should be white to move: ' + await status(A));
assert((await status(B)).includes('Waiting'), 'guest should be waiting: ' + await status(B));
// guest sees a flipped board (a1 top-right area, h-file first)
assert((await B.$eval('#plate-bottom .plate-sub', el => el.textContent)) === 'black', 'guest not black');
console.log('4. two tabs connected, colors assigned: ok');

await clickSq(A, 'e2', 'A'); await clickSq(A, 'e4', 'A');
await B.waitForFunction(() => document.querySelector('[data-sq="e4"]')?.classList.contains('wp'), { timeout: 10000 });
await clickSq(B, 'e7', 'B'); await clickSq(B, 'e5', 'B');
await A.waitForFunction(() => document.querySelector('[data-sq="e5"]')?.classList.contains('bp'), { timeout: 10000 });
assert((await status(A)).includes('Your move'), 'turn did not come back to host');
console.log('5. moves sync live in both directions: ok');

// capture: exd5 after d7d5? play d-pawn trade to light up the capture plates
await clickSq(A, 'd2', 'A'); await clickSq(A, 'd4', 'A');
await B.waitForFunction(() => document.querySelector('[data-sq="d4"]')?.classList.contains('wp'), { timeout: 10000 });
await clickSq(B, 'e5', 'B'); await clickSq(B, 'd4', 'B'); // pawn takes
await A.waitForFunction(() => document.querySelector('#caps-top i') !== null, { timeout: 10000 });
console.log('6. captured pieces show on the plate: ok');

// resign propagates
await B.$eval('#c-resign', el => el.click());
await A.waitForSelector('.result-card', { timeout: 10000 });
assert((await A.$eval('.result-sub', el => el.textContent)).includes('resigned'), 'host did not see resignation');
await B.waitForSelector('.result-card', { timeout: 10000 });
console.log('7. resign propagates to both boards: ok');

// rematch handshake swaps colors
await A.$eval('#replay-btn', el => el.click());
await B.$eval('#replay-btn', el => el.click());
await A.waitForFunction(() => document.querySelector('#plate-bottom .plate-sub')?.textContent === 'black', { timeout: 15000 });
await B.waitForFunction(() => /Your move/.test(document.querySelector('#cs')?.textContent || ''), { timeout: 15000 });
await clickSq(B, 'e2', 'B'); await clickSq(B, 'e4', 'B');
await A.waitForFunction(() => document.querySelector('[data-sq="e4"]')?.classList.contains('wp'), { timeout: 10000 });
console.log('8. rematch swaps colors and plays on: ok');

// dead invite: close both, open the old link fresh -> graceful fallback to engine game
await A.close(); await B.close();
const C = await newPage();
await gotoApp(C, invite);
await C.waitForFunction(() => document.querySelector('#c-diff') && /Your move/.test(document.querySelector('#cs')?.textContent || ''), { timeout: 30000 });
console.log('9. dead invite falls back to engine game: ok');

// legacy move-list links are ignored, app still boots
await gotoApp(C, BASE + '/app/?match=chess&moves=e2e4.e7e5&from=x');
await C.waitForSelector('.app-head', { timeout: 10000 });
console.log('10. legacy links ignored cleanly: ok');

// ---------- 3. typing challenge: same seed, same words, target shown ----------
await gotoApp(C, BASE + '/app/?challenge=typing&seed=4242&score=77&wpm=55&from=riv');
await C.waitForSelector('.invite-banner', { timeout: 10000 });
assert((await C.$eval('.invite-banner', el => el.textContent)).includes('77'), 'typing target missing');
const words1 = await C.$eval('#tw', el => el.textContent);
await gotoApp(C, BASE + '/app/?challenge=typing&seed=4242&score=77&wpm=55&from=riv');
await C.waitForSelector('#tw', { timeout: 10000 });
const words2 = await C.$eval('#tw', el => el.textContent);
assert(words1 === words2 && words1.length > 50, 'typing words not deterministic');
console.log('11. typing challenge deterministic words + target: ok');

await browser.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ALL PASS');
