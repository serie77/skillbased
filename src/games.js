/* skillbased - games: reaction, aim, typing, sequence, number memory */
import { state } from './state.js';
import { showResult } from './ui.js';
import { WORDS } from './words.js';
import { newSeed, seededWords, typingLink, linkBox } from './challenge.js';

/* ---------------- Reaction Time ---------------- */
state.games.push({
  id: 'reaction',
  name: 'Reaction Time',

  skill: 'mechanics · speed',
  desc: 'Wait for green, click as fast as you can. 5 rounds, average counts.',
  render(el, finish) {
    let timers = [];
    const start = () => {
      let round = 0, times = [], goAt = 0, phase = 'idle';
      el.innerHTML = `
        <div class="game-stage">
          <div class="round-dots" id="rx-dots">${'<i></i>'.repeat(5)}</div>
          <div class="arena reaction" id="rx-arena"><span>Click to start</span><span class="sub">5 rounds. React when it turns green</span></div>
          <p class="hint" id="rx-status">Sub-200ms average is elite.</p>
        </div>`;
      const arena = el.querySelector('#rx-arena');
      const status = el.querySelector('#rx-status');
      const dots = [...el.querySelectorAll('#rx-dots i')];

      const nextRound = () => {
        phase = 'waiting';
        arena.className = 'arena reaction waiting';
        arena.innerHTML = `<span>Wait for green…</span><span class="sub">round ${round + 1} / 5</span>`;
        timers.push(setTimeout(() => {
          phase = 'go';
          goAt = 0;
          arena.className = 'arena reaction go';
          arena.innerHTML = `<span>CLICK!</span>`;
          // clock starts when the green frame actually paints, not when we set the class
          requestAnimationFrame(() => requestAnimationFrame(() => { goAt = performance.now(); }));
        }, 1000 + Math.random() * 3000));
      };

      // pointerdown, not click - click fires on mouse-UP and adds your button-hold time
      arena.addEventListener('pointerdown', e => {
        if (phase === 'idle') { nextRound(); return; }
        if (phase === 'waiting') {
          timers.forEach(clearTimeout); timers = [];
          phase = 'idle';
          arena.className = 'arena reaction';
          arena.innerHTML = `<span>Too early!</span><span class="sub">click to retry the round</span>`;
          return;
        }
        if (phase === 'go' && goAt) {
          // e.timeStamp is the hardware event time - cheaper than handler-run time
          const ms = Math.max(1, Math.round(e.timeStamp - goAt));
          times.push(ms);
          round++;
          dots[round - 1]?.classList.add('done');
          status.textContent = `Round ${round}: ${ms}ms [${times.join(', ')}]`;
          if (round >= 5) {
            const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
            if (avg < 90) { // beyond human range - anti-cheat void
              showResult(el, null, `${avg}ms average is beyond human range. Run voided by anti-cheat.`, start);
              return;
            }
            const pts = Math.max(5, Math.min(150, Math.round((450 - avg) / 2)));
            finish(pts, `Reaction avg ${avg}ms`);
            showResult(el, pts, `Average reaction: ${avg}ms over 5 rounds`, start);
          } else {
            phase = 'idle';
            arena.className = 'arena reaction';
            arena.innerHTML = `<span>${ms}ms</span><span class="sub">click for round ${round + 1}</span>`;
          }
        }
      });
    };
    start();
    return () => timers.forEach(clearTimeout);
  },
});

/* ---------------- Aim Trainer ---------------- */
state.games.push({
  id: 'aim',
  name: 'Aim Trainer',

  skill: 'mechanics · precision',
  desc: 'Hit 15 targets as fast as possible. Speed and precision under pressure.',
  render(el, finish) {
    const TOTAL = 15;
    const start = () => {
      let hits = 0, t0 = 0;
      el.innerHTML = `
        <div class="game-stage">
          <div class="arena aim" id="aim-arena"></div>
          <div class="aim-progress"><i id="aim-fill"></i></div>
          <p class="hint" id="aim-status">Click the first target to start the clock.</p>
        </div>`;
      const arena = el.querySelector('#aim-arena');
      const status = el.querySelector('#aim-status');
      const fill = el.querySelector('#aim-fill');

      const spawn = () => {
        const t = document.createElement('div');
        t.className = 'target';
        t.style.left = 8 + Math.random() * (arena.clientWidth - 62) + 'px';
        t.style.top = 8 + Math.random() * (arena.clientHeight - 62) + 'px';
        t.addEventListener('pointerdown', e => {
          e.stopPropagation();
          if (hits === 0) t0 = performance.now();
          hits++;
          t.remove();
          if (hits >= TOTAL) {
            const total = performance.now() - t0;
            const avg = Math.round(total / (TOTAL - 1));
            if (avg < 120) { // scripted-clicker territory
              showResult(el, null, `${avg}ms per target is beyond human range. Run voided by anti-cheat.`, start);
              return;
            }
            const pts = Math.max(5, Math.min(150, Math.round((1400 - avg) / 9)));
            finish(pts, `Aim avg ${avg}ms/target`);
            showResult(el, pts, `${avg}ms per target, ${(total / 1000).toFixed(1)}s total`, start);
          } else {
            status.textContent = `${hits} / ${TOTAL}`;
            fill.style.width = (100 * hits / TOTAL) + '%';
            spawn();
          }
        });
        arena.appendChild(t);
      };
      spawn();
    };
    start();
  },
});

/* ---------------- Typing Test ---------------- */
state.games.push({
  id: 'typing',
  name: 'Typing Test',

  skill: 'mechanics · execution',
  desc: '30 seconds, as many words as you can. Race friends with invite links.',
  render(el, finish, ctx) {
    let timer = null;
    const start = () => {
      clearInterval(timer);
      const seed = ctx?.seed ?? newSeed();
      const words = seededWords(seed);
      let idx = 0, correct = 0, wrong = 0, chars = 0, timeLeft = 30, running = false;
      const states = [];

      el.innerHTML = `
        <div class="game-stage">
          ${ctx ? `<div class="invite-banner"><span class="vs">VS</span><span><b>${ctx.from}</b> challenged you: same words, same clock. Beat <b>${ctx.score} pts</b> (${ctx.wpm} wpm).</span></div>` : ''}
          <div class="type-words" id="tw"></div>
          <input class="type-input" id="ti" placeholder="Start typing to begin…" autocomplete="off" spellcheck="false">
          <div class="type-meta"><span id="t-time">30s</span><span id="t-wpm">0 wpm</span><span id="t-acc">100% acc</span>${ctx ? `<span>target ${ctx.score} pts</span>` : ''}</div>
        </div>`;
      const tw = el.querySelector('#tw'), ti = el.querySelector('#ti');

      const draw = () => {
        const from = Math.max(0, idx - (idx % 12));
        tw.innerHTML = words.slice(from, from + 36).map((w, i) => {
          const j = from + i;
          if (j === idx) return `<span class="cur">${w}</span>`;
          if (j < idx) return `<span class="${states[j] ? 'done' : 'bad'}">${w}</span>`;
          return `<span>${w}</span>`;
        }).join(' ');
      };

      const end = () => {
        clearInterval(timer);
        const wpm = Math.round((chars / 5) / 0.5);
        const acc = correct + wrong === 0 ? 0 : correct / (correct + wrong);
        if (wpm > 230) { // faster than the world record pace - voided
          showResult(el, null, `${wpm} wpm is beyond human range. Run voided by anti-cheat.`, start);
          return;
        }
        const pts = Math.max(5, Math.min(200, Math.round(wpm * acc)));
        finish(pts, `Typing ${wpm} wpm`);
        let sub = `${wpm} wpm · ${Math.round(acc * 100)}% accuracy`;
        if (ctx) sub += pts > ctx.score
          ? `. You beat ${ctx.from}'s ${ctx.score} pts!`
          : `. ${ctx.from}'s ${ctx.score} pts stands.`;
        showResult(el, pts, sub, start,
          linkBox('Challenge a friend to this exact run:', typingLink(seed, pts, wpm)));
      };

      ti.addEventListener('input', () => {
        if (!running) {
          running = true;
          timer = setInterval(() => {
            timeLeft--;
            el.querySelector('#t-time').textContent = timeLeft + 's';
            if (timeLeft <= 0) end();
          }, 1000);
        }
        const v = ti.value;
        if (v.endsWith(' ')) {
          const typed = v.trim();
          const ok = typed === words[idx];
          states[idx] = ok;
          if (ok) { correct++; chars += words[idx].length + 1; } else wrong++;
          idx++;
          ti.value = '';
          const acc = correct + wrong ? Math.round(100 * correct / (correct + wrong)) : 100;
          const elapsed = (30 - timeLeft) / 60 || 1 / 60;
          el.querySelector('#t-wpm').textContent = Math.round((chars / 5) / elapsed) + ' wpm';
          el.querySelector('#t-acc').textContent = acc + '% acc';
          draw();
        }
      });

      draw();
      setTimeout(() => ti.focus(), 50);
    };
    start();
    return () => clearInterval(timer);
  },
});

/* ---------------- Sequence Memory ---------------- */
state.games.push({
  id: 'sequence',
  name: 'Sequence Memory',

  skill: 'mentality · memory',
  desc: 'Watch the pattern, repeat it back. One tile longer every level.',
  render(el, finish) {
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const start = () => {
      timers.forEach(clearTimeout); timers = [];
      let seq = [], pos = 0, level = 0, showing = false, dead = false;

      el.innerHTML = `
        <div class="game-stage">
          <div class="big-num" id="sq-level">Level 1</div>
          <div class="seq-grid" id="sq-grid">${Array.from({ length: 9 }, (_, i) => `<button class="seq-cell" data-i="${i}"></button>`).join('')}</div>
          <p class="hint" id="sq-status">Watch the pattern…</p>
        </div>`;
      const cells = [...el.querySelectorAll('.seq-cell')];
      const status = el.querySelector('#sq-status');

      const flash = (i, ms, cls = 'lit') => {
        cells[i].classList.add(cls);
        later(() => cells[i].classList.remove(cls), ms);
      };

      const playSeq = () => {
        showing = true;
        status.textContent = 'Watch the pattern…';
        seq.push(Math.floor(Math.random() * 9));
        el.querySelector('#sq-level').textContent = 'Level ' + seq.length;
        seq.forEach((c, i) => later(() => flash(c, 380), 600 + i * 560));
        later(() => { showing = false; pos = 0; status.textContent = 'Your turn.'; }, 600 + seq.length * 560);
      };

      cells.forEach(cell => cell.addEventListener('click', () => {
        if (showing || dead) return;
        const i = +cell.dataset.i;
        if (i === seq[pos]) {
          flash(i, 200);
          pos++;
          if (pos === seq.length) { level = seq.length; later(playSeq, 500); }
        } else {
          dead = true;
          flash(i, 500, 'err');
          const pts = Math.max(5, level * 15);
          finish(pts, `Sequence level ${level}`);
          later(() => showResult(el, pts, `Reached level ${level}`, start), 600);
        }
      }));

      playSeq();
    };
    start();
    return () => timers.forEach(clearTimeout);
  },
});

/* ---------------- Number Memory ---------------- */
state.games.push({
  id: 'numbers',
  name: 'Number Memory',

  skill: 'mentality · focus',
  desc: "A number flashes, then it's gone. Type it back. Digits grow each level.",
  render(el, finish) {
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const start = () => {
      timers.forEach(clearTimeout); timers = [];
      let level = 1;

      const round = () => {
        const digits = level + 3;
        const num = Array.from({ length: digits }, (_, i) => Math.floor(Math.random() * (i ? 10 : 9)) + (i ? 0 : 1)).join('');
        el.innerHTML = `
          <div class="game-stage">
            <p class="hint">Level ${level}: ${digits} digits</p>
            <div class="big-num" id="nm-num">${num}</div>
            <p class="hint">Memorize it…</p>
          </div>`;
        later(() => {
          el.innerHTML = `
            <div class="game-stage">
              <p class="hint">Level ${level}. What was the number?</p>
              <input class="num-input" id="nm-in" inputmode="numeric" autocomplete="off">
              <button class="btn btn-primary" id="nm-go">Submit</button>
            </div>`;
          const input = el.querySelector('#nm-in');
          input.focus();
          const submit = () => {
            if (input.value === num) { level++; round(); }
            else {
              const reached = level - 1;
              const pts = Math.max(5, reached * 20);
              finish(pts, `Numbers level ${reached}`);
              showResult(el, pts, `Remembered ${reached + 3} digits (level ${reached}) · it was ${num}`, start);
            }
          };
          el.querySelector('#nm-go').addEventListener('click', submit);
          input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        }, 1300 + digits * 480);
      };
      round();
    };
    start();
    return () => timers.forEach(clearTimeout);
  },
});
