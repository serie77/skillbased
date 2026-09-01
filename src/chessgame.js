/* skillbased - chess vs an engine (chess.js 1.x) with three difficulty levels,
   plus LIVE friend matches: the invite link opens a WebRTC data channel (PeerJS)
   and moves sync in real time. Host plays white; rematches swap colors. */
import { Chess } from 'chess.js';
import Peer from 'peerjs';
import { state, shortAddr } from './state.js';
import { showResult, toast } from './ui.js';
import { chessInvite, linkBox } from './challenge.js';
import { rowsToSVG } from './pixel.js';

const PIECE_GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const INIT_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/* chess.com-style board themes */
const THEMES = [
  { id: 'classic',  name: 'Classic',  light: '#ebecd0', dark: '#739552', wp: '#ffffff', bp: '#1f1d1a' },
  { id: 'mint',     name: 'Mint',     light: '#e8f5ec', dark: '#5fae86', wp: '#ffffff', bp: '#12271b' },
  { id: 'walnut',   name: 'Walnut',   light: '#f0d9b5', dark: '#b58863', wp: '#ffffff', bp: '#241f1a' },
  { id: 'ocean',    name: 'Ocean',    light: '#dee3e6', dark: '#6d8ea6', wp: '#ffffff', bp: '#15202b' },
  { id: 'slate',    name: 'Slate',    light: '#dfe5e1', dark: '#5f6f66', wp: '#ffffff', bp: '#161d19' },
];
const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];

/* Engine difficulty. Checkmate-win points scale with it; the 250 daily cap is the Hard win. */
const DIFFS = [
  { id: 'easy',   name: 'Easy',   win: 100, drawScale: 0.4 },
  { id: 'medium', name: 'Medium', win: 175, drawScale: 0.7 },
  { id: 'hard',   name: 'Hard',   win: 250, drawScale: 1 },
];
const diffById = id => DIFFS.find(d => d.id === id) || DIFFS[1];

const myName = () => shortAddr() || 'guest';

/* 5x5 symmetric pixel identicon, seeded by name */
function identicon(name) {
  let h = 5381;
  for (const c of String(name)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  const rows = [];
  for (let y = 0; y < 5; y++) {
    let row = '';
    for (let x = 0; x < 3; x++) {
      h = (h * 1103515245 + 12345) >>> 0;
      row += (h >> 16) % 3 ? 'abv'[(h >> 8) % 3] : '.';
    }
    rows.push(row + row[1] + row[0]);
  }
  return rowsToSVG(rows, { a: '#22c55e', b: '#a3e635', v: '#15803d' }, { size: '1em' });
}

const botAvatar = rowsToSVG(
  ['.aaa.', 'avava', 'aaaaa', '.a.a.', '.aaa.'],
  { a: '#5f6f66', v: '#a3e635' }, { size: '1em' });

state.games.push({
  id: 'chess',
  name: 'Chess',

  skill: 'mentality · strategy',
  desc: 'Beat the engine on three difficulties, or play a friend live by invite link.',
  render(el, finish, ctx) {
    let aiTimer = null;
    let peer = null, conn = null;
    /* live: null for engine games, else { myColor, oppName, rematchMe, rematchOpp } */
    let live = null;

    const cleanupNet = () => {
      try { conn?.close(); } catch {}
      try { peer?.destroy(); } catch {}
      peer = conn = null; live = null;
    };
    const send = msg => { try { conn?.send(msg); } catch {} };

    /* ---------------- shared game screen (engine + live) ---------------- */
    const startGame = () => {
      clearTimeout(aiTimer);
      const game = new Chess();
      let diff = diffById(localStorage.getItem('sb_diff'));
      let sel = null, lastMove = null, over = false;

      const oppLabel = live ? live.oppName : `Engine · ${diff.name}`;
      const oppAvatar = live ? identicon(live.oppName) : botAvatar;
      const mySub = live ? (live.myColor === 'w' ? 'white' : 'black') : 'white';
      const oppSub = live ? (live.myColor === 'w' ? 'black' : 'white') : 'black';

      el.innerHTML = `
        <div class="chess-wrap">
          ${live ? `<div class="invite-banner"><span class="vs">VS</span><span>Live match vs <b>${live.oppName}</b>. Moves sync in real time. Friendly matches score no points.</span></div>` : ''}
          <div class="chess-topbar">
            <div class="chess-status" id="cs"></div>
            ${live ? '' : `
            <div class="board-themes" id="c-diff">
              <span>Engine</span>
              ${DIFFS.map(d => `<button class="diff-pill${d === diff ? ' active' : ''}" data-diff="${d.id}">${d.name}</button>`).join('')}
            </div>`}
            <div class="board-themes" id="c-themes">
              <span>Board</span>
              ${THEMES.map(t => `<button class="theme-swatch" data-theme="${t.id}" title="${t.name}"><i style="background:${t.light}"></i><i style="background:${t.dark}"></i></button>`).join('')}
            </div>
          </div>
          <div class="plate" id="plate-top">
            <span class="plate-avatar">${oppAvatar}</span>
            <span class="plate-info"><b>${oppLabel}</b><span class="plate-sub">${oppSub}</span></span>
            <span class="plate-caps" id="caps-top"></span>
            <span class="turn-dot" id="turn-top" hidden></span>
          </div>
          <div class="chess-board" id="cb"></div>
          <div class="plate" id="plate-bottom">
            <span class="plate-avatar">${identicon(myName())}</span>
            <span class="plate-info"><b>${myName()} (you)</b><span class="plate-sub">${mySub}</span></span>
            <span class="plate-caps" id="caps-bottom"></span>
            <span class="turn-dot" id="turn-bottom" hidden></span>
          </div>
          <div class="chess-actions" id="c-actions">
            <button class="btn btn-ghost" id="c-resign">Resign</button>
            ${live ? '' : '<button class="btn btn-ghost" id="c-invite">Play a friend live</button>'}
          </div>
        </div>`;
      const boardEl = el.querySelector('#cb');
      const statusEl = el.querySelector('#cs');

      const applyTheme = t => {
        boardEl.style.setProperty('--sq-light', t.light);
        boardEl.style.setProperty('--sq-dark', t.dark);
        boardEl.style.setProperty('--wp', t.wp);
        boardEl.style.setProperty('--bp', t.bp);
        el.querySelectorAll('.theme-swatch').forEach(s =>
          s.classList.toggle('active', s.dataset.theme === t.id));
      };
      applyTheme(themeById(localStorage.getItem('sb_board')));
      el.querySelector('#c-themes').addEventListener('click', e => {
        const s = e.target.closest('.theme-swatch');
        if (!s) return;
        localStorage.setItem('sb_board', s.dataset.theme);
        applyTheme(themeById(s.dataset.theme));
      });

      // switching difficulty starts a fresh engine game
      el.querySelector('#c-diff')?.addEventListener('click', e => {
        const b = e.target.closest('.diff-pill');
        if (!b || b.dataset.diff === diff.id) return;
        localStorage.setItem('sb_diff', b.dataset.diff);
        startGame();
        toast(`New game vs the <b>${diffById(b.dataset.diff).name}</b> engine.`);
      });

      const myColor = () => live ? live.myColor : 'w';
      const legalFrom = sq => game.moves({ square: sq, verbose: true });

      const updStatus = txt => {
        if (txt) { statusEl.textContent = txt; return; }
        const mine = game.turn() === myColor();
        statusEl.textContent = (game.inCheck() ? 'Check. ' : '') +
          (mine ? 'Your move.' : live ? `Waiting on ${live.oppName}…` : 'Engine thinking…');
      };

      const updPlates = () => {
        const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        for (const row of game.board()) for (const p of row) if (p && p.type !== 'k') count[p.color][p.type]++;
        const caps = c => { // pieces colour c has captured (opponent's missing), plus material lead
          const opp = c === 'w' ? 'b' : 'w';
          let html = '', val = 0;
          for (const t of ['q', 'r', 'b', 'n', 'p']) {
            const n = INIT_COUNT[t] - count[opp][t];
            for (let i = 0; i < n; i++) { html += `<i class="${opp === 'w' ? 'cw' : 'cb'}">${PIECE_GLYPH[t]}</i>`; val += PIECE_VAL[t]; }
          }
          return { html, val };
        };
        const mine = caps(myColor()), theirs = caps(myColor() === 'w' ? 'b' : 'w');
        el.querySelector('#caps-bottom').innerHTML = mine.html + (mine.val > theirs.val ? `<b>+${mine.val - theirs.val}</b>` : '');
        el.querySelector('#caps-top').innerHTML = theirs.html + (theirs.val > mine.val ? `<b>+${theirs.val - mine.val}</b>` : '');
        el.querySelector('#turn-bottom').hidden = over || game.turn() !== myColor();
        el.querySelector('#turn-top').hidden = over || game.turn() === myColor();
      };

      const draw = () => {
        const board = game.board();
        const moves = sel ? legalFrom(sel) : [];
        const flip = myColor() === 'b';
        let html = '';
        for (let ri = 0; ri < 8; ri++) {
          for (let fi = 0; fi < 8; fi++) {
            const r = flip ? 7 - ri : ri, f = flip ? 7 - fi : fi;
            const sq = 'abcdefgh'[f] + (8 - r);
            const piece = board[r][f];
            const mv = moves.find(m => m.to === sq);
            const cls = [
              'sq',
              (r + f) % 2 ? 'dark' : 'light',
              piece ? (piece.color === 'w' ? 'wp' : 'bp') : '',
              sel === sq ? 'sel' : '',
              lastMove && (lastMove.from === sq || lastMove.to === sq) ? 'last' : '',
              mv && piece ? 'cap' : '',
            ].join(' ');
            const coords =
              (fi === 0 ? `<span class="coord rank">${sq[1]}</span>` : '') +
              (ri === 7 ? `<span class="coord file">${sq[0]}</span>` : '');
            html += `<div class="${cls}" data-sq="${sq}">${coords}${piece ? PIECE_GLYPH[piece.type] : ''}${mv ? '<span class="dot"></span>' : ''}</div>`;
          }
        }
        boardEl.innerHTML = html;
        updPlates();
      };

      const materialEdge = () => {
        let edge = 0;
        for (const row of game.board()) for (const p of row)
          if (p) edge += (p.color === 'w' ? 1 : -1) * PIECE_VAL[p.type];
        return edge;
      };

      /* result screen. Live matches score no points; "Play again" starts a rematch handshake. */
      const endGame = (sub0, iResigned) => {
        over = true; updPlates();
        if (live) {
          live.rematchMe = live.rematchOpp = false;
          const replay = () => {
            if (!conn?.open) { toast(`${live.oppName} is gone. Starting an engine game.`); cleanupNet(); startGame(); return; }
            live.rematchMe = true;
            send({ t: 'rematch' });
            updStatus(`Rematch offered. Waiting on ${live.oppName}…`);
            maybeRematch();
          };
          showResult(el, 0, sub0 + ' Friendly matches score no points.', replay);
          return;
        }
        let pts, label, sub = sub0;
        if (iResigned) {
          pts = 5; label = 'Chess: resigned';
        } else if (game.isCheckmate()) {
          const won = game.turn() === 'b';
          pts = won ? diff.win : 15;
          label = won ? `Chess: checkmate win (${diff.name})` : 'Chess: loss';
        } else {
          pts = Math.max(20, Math.round((100 + materialEdge() * 5) * diff.drawScale));
          label = `Chess: draw (${diff.name})`;
        }
        finish(pts, label);
        showResult(el, pts, sub, startGame);
      };

      const finishByBoard = () => {
        if (game.isCheckmate()) {
          const iWon = game.turn() !== myColor();
          endGame(live
            ? (iWon ? `Checkmate. You beat ${live.oppName}.` : `Checkmate. ${live.oppName} takes it.`)
            : (iWon ? `Checkmate. You beat the ${diff.name} engine.` : 'Checkmated. Review and requeue.'), false);
        } else {
          endGame(live ? 'Match drawn.' : 'Drawn game.', false);
        }
      };

      const maybeRematch = () => {
        if (live && live.rematchMe && live.rematchOpp) {
          live.myColor = live.myColor === 'w' ? 'b' : 'w'; // colors swap every rematch
          startGame();
          toast(`Rematch. You play <b>${live.myColor === 'w' ? 'white' : 'black'}</b>.`);
        }
      };

      /* live wire-in: this game screen owns the connection callbacks */
      if (live) {
        live.onMsg = d => {
          if (!d || typeof d !== 'object') return;
          if (d.t === 'move' && !over && game.turn() !== live.myColor && typeof d.m === 'string') {
            let mv = null;
            try { mv = game.move({ from: d.m.slice(0, 2), to: d.m.slice(2, 4), promotion: d.m[4] || undefined }); } catch { return; }
            lastMove = mv; sel = null;
            draw(); updStatus();
            if (game.isGameOver()) finishByBoard();
          } else if (d.t === 'resign' && !over) {
            endGame(`${live.oppName} resigned. You win.`, false);
          } else if (d.t === 'rematch') {
            live.rematchOpp = true;
            if (!live.rematchMe) toast(`${live.oppName} wants a rematch. Hit <b>Play again</b>.`);
            maybeRematch();
          }
        };
        live.onGone = () => {
          if (over) { toast(`${live.oppName} left.`); cleanupNet(); return; }
          endGame(`${live.oppName} disconnected.`, false);
          cleanupNet();
        };
      }

      /* engine: Easy plays random. Medium plays greedy captures. Hard looks one reply
         ahead and avoids moves that hang material or walk into mate. */
      const aiMove = () => {
        const moves = game.moves({ verbose: true });
        if (!moves.length) return finishByBoard();
        let best = null;
        if (diff.id === 'easy') {
          best = moves[Math.floor(Math.random() * moves.length)];
        } else {
          let bestVal = -Infinity;
          for (const m of moves) {
            let v = (m.captured ? PIECE_VAL[m.captured] : 0) + (m.promotion ? 8 : 0) + Math.random();
            if (m.san.includes('#')) v += 1000;
            if (diff.id === 'hard') {
              game.move(m);
              let reply = 0;
              if (!game.isGameOver()) {
                for (const r of game.moves({ verbose: true })) {
                  const rv = (r.captured ? PIECE_VAL[r.captured] : 0) + (r.san.includes('#') ? 1000 : 0);
                  if (rv > reply) reply = rv;
                }
              }
              game.undo();
              v -= reply;
            }
            if (v > bestVal) { bestVal = v; best = m; }
          }
        }
        game.move(best);
        lastMove = best;
        draw();
        if (game.isGameOver()) return finishByBoard();
        updStatus();
      };

      boardEl.addEventListener('click', e => {
        if (over || game.turn() !== myColor()) return;
        const sqEl = e.target.closest('[data-sq]');
        if (!sqEl) return;
        const sq = sqEl.dataset.sq;
        const piece = game.get(sq);

        if (sel && legalFrom(sel).some(m => m.to === sq)) {
          let mv = null;
          try { mv = game.move({ from: sel, to: sq, promotion: 'q' }); } catch { return; }
          lastMove = mv; sel = null;
          draw();
          if (live) send({ t: 'move', m: mv.from + mv.to + (mv.promotion || '') });
          if (game.isGameOver()) return finishByBoard();
          updStatus();
          if (!live) aiTimer = setTimeout(aiMove, 350 + Math.random() * 450);
        } else if (piece && piece.color === myColor()) {
          sel = sel === sq ? null : sq;
          draw();
        } else {
          sel = null;
          draw();
        }
      });

      el.querySelector('#c-resign').addEventListener('click', () => {
        if (over) return;
        if (live) { send({ t: 'resign' }); endGame(`You resigned. ${live.oppName} wins.`, true); }
        else endGame('Resigned. Sit back down tomorrow.', true);
      });
      el.querySelector('#c-invite')?.addEventListener('click', startHost);

      draw();
      updStatus();
    };

    /* ---------------- live match setup ---------------- */
    const wireConn = c => {
      conn = c;
      conn.on('data', d => {
        if (d?.t === 'hello') {
          if (live) {
            live.oppName = String(d.name || 'guest').slice(0, 24);
            const b = el.querySelector('#plate-top b');
            if (b && live) b.textContent = live.oppName;
          }
          return;
        }
        live?.onMsg?.(d);
      });
      conn.on('close', () => live?.onGone?.());
      conn.on('error', () => live?.onGone?.());
    };

    const startHost = () => {
      cleanupNet();
      clearTimeout(aiTimer);
      el.innerHTML = `
        <div class="chess-wrap">
          <div class="invite-banner"><span class="vs">VS</span><span>Live match. Send the link below. The game starts the moment your friend opens it. <b>Keep this tab open.</b></span></div>
          <div class="chess-status" id="cs">Setting up a live game…</div>
          <div class="game-loading"><div class="gl-px">${'<i></i>'.repeat(9)}</div><span>WAITING FOR OPPONENT</span></div>
          <div id="c-linkslot" style="width:100%"></div>
          <div class="chess-actions"><button class="btn btn-ghost" id="c-cancel">Cancel</button></div>
        </div>`;
      el.querySelector('#c-cancel').addEventListener('click', () => { cleanupNet(); startGame(); });

      peer = new Peer();
      peer.on('open', id => {
        el.querySelector('#cs').textContent = 'Waiting for your friend to join…';
        el.querySelector('#c-linkslot').innerHTML =
          linkBox('Send this invite link. You play white when they join:', chessInvite(id));
      });
      peer.on('connection', c => {
        if (conn) { c.close(); return; } // one opponent per board
        live = { myColor: 'w', oppName: 'guest', rematchMe: false, rematchOpp: false };
        wireConn(c);
        c.on('open', () => {
          send({ t: 'hello', name: myName() });
          setTimeout(() => { startGame(); toast(`<b>${live.oppName}</b> joined. You play white.`); }, 150);
        });
      });
      peer.on('error', () => {
        el.querySelector('#cs').textContent = 'Could not reach the matchmaking service. Try again.';
      });
    };

    const startGuest = (joinId, fromName) => {
      cleanupNet();
      el.innerHTML = `
        <div class="chess-wrap">
          <div class="chess-status" id="cs">Joining ${fromName}'s match…</div>
          <div class="game-loading"><div class="gl-px">${'<i></i>'.repeat(9)}</div><span>CONNECTING</span></div>
        </div>`;
      peer = new Peer();
      const fail = msg => {
        cleanupNet();
        el.querySelector('#cs') && (el.querySelector('#cs').textContent = msg);
        setTimeout(() => { startGame(); toast(msg); }, 900);
      };
      peer.on('open', () => {
        const c = peer.connect(joinId, { reliable: true });
        live = { myColor: 'b', oppName: fromName, rematchMe: false, rematchOpp: false };
        wireConn(c);
        c.on('open', () => {
          send({ t: 'hello', name: myName() });
          setTimeout(() => { startGame(); toast(`Connected. You play black vs <b>${live.oppName}</b>.`); }, 150);
        });
      });
      peer.on('error', e => {
        if (e?.type === 'peer-unavailable') fail('That invite is no longer live. The host must keep their board open.');
        else fail('Could not connect. Ask for a fresh invite link.');
      });
    };

    if (ctx?.join) startGuest(ctx.join, ctx.from || 'a rival');
    else startGame();

    return () => { clearTimeout(aiTimer); cleanupNet(); };
  },
});
