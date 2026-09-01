/* E2E: chess engine difficulty, chess match-by-link ping-pong, corrupt links, typing challenge.
   Run: npm run build && npx vite preview --port 4173  (in another terminal), then: npm run test:e2e */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const BASE = 'http://localhost:4173';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

process.on('unhandledRejection', e => { console.log('FAILED:', e.message); if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); });
const gotoApp = async url => {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.splash.done', { timeout: 20000 });
};
const sq = s => page.click(`[data-sq="${s}"]`);
const status = () => page.$eval('#cs', el => el.textContent);
const linkVal = () => page.$eval('.link-input', el => el.value);
const waitEngine = () => page.waitForFunction(
  () => !document.querySelector('#cs')?.textContent.includes('thinking'), { timeout: 8000 });

// ---------- 1. engine game + difficulty pills ----------
await gotoApp(BASE + '/app/#chess');
await page.waitForSelector('#cb .sq', { timeout: 10000 });
assert(await page.$('#c-diff'), 'difficulty selector missing');
await page.click('[data-diff="hard"]');
await page.waitForSelector('[data-diff="hard"].active', { timeout: 5000 });
await page.waitForSelector('#cb .sq');
await sq('e2'); await sq('e4');
await waitEngine();
assert(/Your move|Check/.test(await status()), 'engine did not reply: ' + await status());
console.log('1. engine game + hard difficulty: ok');

// difficulty switch mid-game restarts
await page.click('[data-diff="easy"]');
await page.waitForSelector('[data-diff="easy"].active', { timeout: 5000 });
assert((await status()).includes("You're white"), 'difficulty switch did not restart');
console.log('2. difficulty switch restarts: ok');

// ---------- 2. invite flow: fresh match, inviter moves first ----------
await page.$eval('#c-invite', el => el.click());
await page.waitForSelector('.invite-banner');
assert((await page.$eval('.invite-banner', el => el.textContent)).includes('first move'), 'fresh banner wrong');
await sq('e2'); await sq('e4');
await page.waitForSelector('.link-input');
const link1 = await linkVal();
assert(link1.includes('/app/?match=chess&moves=e2e4'), 'invite link wrong: ' + link1);
console.log('3. invite creates fresh match, link after first move: ok');

// friend opens the invite: plays black on a flipped board
await gotoApp(link1);
await page.waitForSelector('.invite-banner', { timeout: 10000 });
const b1 = await page.$eval('.invite-banner', el => el.textContent);
assert(b1.includes('black'), 'friend should play black: ' + b1);
// last move highlighted
assert(await page.$('.sq.last'), 'no last-move highlight after replay');
await sq('e7'); await sq('e5');
await page.waitForSelector('.link-input');
const link2 = await linkVal();
assert(link2.includes('moves=e2e4.e7e5'), 'reply link wrong: ' + link2);
console.log('4. friend replies as black: ok');

// inviter opens the reply: plays white again
await gotoApp(link2);
await page.waitForSelector('.invite-banner', { timeout: 10000 });
assert((await page.$eval('.invite-banner', el => el.textContent)).includes('white'), 'inviter should be white');
await sq('g1'); await sq('f3');
await page.waitForSelector('.link-input');
assert((await linkVal()).includes('e2e4.e7e5.g1f3'), 'third link wrong');
console.log('5. ping-pong continues: ok');

// ---------- 3. a link that arrives already checkmated shows the result ----------
await gotoApp(BASE + '/app/?match=chess&moves=f2f3.e7e5.g2g4.d8h4&from=riv');
await page.waitForSelector('.result-card', { timeout: 10000 });
const sub = await page.$eval('.result-sub', el => el.textContent);
assert(sub.includes('riv takes it'), 'mate-on-open result wrong: ' + sub);
console.log('6. checkmated link shows result immediately: ok');

// ---------- 4. corrupt link falls back to a clean engine game ----------
await gotoApp(BASE + '/app/?match=chess&moves=zz9x.abcd&from=x');
await page.waitForSelector('#cb .sq', { timeout: 10000 });
assert(!(await page.$('.invite-banner')), 'corrupt link should not create a match');
assert((await status()).includes("You're white"), 'corrupt link not a clean engine game');
// board is the starting position (32 pieces)
const pieces = await page.$$eval('#cb .sq', els => els.filter(e => /[♟♞♝♜♛♚]/.test(e.textContent)).length);
assert(pieces === 32, 'corrupt link left a dirty board: ' + pieces);
console.log('7. corrupt link falls back cleanly: ok');

// ---------- 5. typing challenge: same seed, same words, target shown ----------
await gotoApp(BASE + '/app/?challenge=typing&seed=4242&score=77&wpm=55&from=riv');
await page.waitForSelector('.invite-banner', { timeout: 10000 });
assert((await page.$eval('.invite-banner', el => el.textContent)).includes('77'), 'typing target missing');
const words1 = await page.$eval('#tw', el => el.textContent);
await gotoApp(BASE + '/app/?challenge=typing&seed=4242&score=77&wpm=55&from=riv');
await page.waitForSelector('#tw', { timeout: 10000 });
const words2 = await page.$eval('#tw', el => el.textContent);
assert(words1 === words2 && words1.length > 50, 'typing words not deterministic');
console.log('8. typing challenge deterministic words + target: ok');

// ---------- 6. play an easy engine game a few moves for stability ----------
await gotoApp(BASE + '/app/#chess');
await page.waitForSelector('#cb .sq', { timeout: 10000 });
await page.click('[data-diff="easy"]');
await page.waitForSelector('[data-diff="easy"].active');
for (const [a, b] of [['e2', 'e4'], ['d2', 'd4'], ['b1', 'c3']]) {
  await page.waitForFunction(() => /Your move|Check/.test(document.querySelector('#cs').textContent), { timeout: 8000 });
  await sq(a);
  const ok = await page.$(`[data-sq="${b}"] .dot`);
  if (!ok) { await sq(a); continue; } // move blocked by engine's reply; skip
  await sq(b);
  await waitEngine();
}
console.log('9. multi-move engine game stable: ok');

await browser.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ALL PASS');
