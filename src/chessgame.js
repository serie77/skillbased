/* skillbased - chess vs an engine (chess.js 1.x) with three difficulty levels,
   plus friend matches by link: each move generates a reply link, sent back and forth. */
import { Chess } from 'chess.js';
import { state } from './state.js';
import { showResult, toast } from './ui.js';
import { chessLink, linkBox } from './challenge.js';

const PIECE_GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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

state.games.push({
  id: 'chess',
  name: 'Chess',

  skill: 'mentality · strategy',
  desc: 'Beat the engine on three difficulties, or invite a friend to a match by link.',
  render(el, finish, ctx) {
    let aiTimer = null;

    const start = () => {
      clearTimeout(aiTimer);
      const game = new Chess();
      let moveList = [];
      let match = null;
      let diff = diffById(localStorage.getItem('sb_diff'));

      if (ctx?.moves) {
        // match-by-link: replay the position, you play the side to move
        try {
          for (const m of ctx.moves) {
            game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] || undefined });
            moveList.push(m);
          }
          match = { from: ctx.from, color: game.turn(), fresh: !!ctx.fresh };
        } catch {
          // corrupt link: fall back to a clean engine game
          game.reset();
          moveList = [];
          match = null;
        }
      }
      let sel = null, lastMove = null, over = false;
      if (match && moveList.length) {
        const m = moveList[moveList.length - 1];
        lastMove = { from: m.slice(0, 2), to: m.slice(2, 4) };
      }

      const banner = !match ? '' : match.fresh
        ? `<div class="invite-banner"><span class="vs">VS</span><span>New match vs a friend. Make your first move as <b>white</b>, then send them the link.</span></div>`
        : `<div class="invite-banner"><span class="vs">VS</span><span>Match vs <b>${match.from}</b>. You play <b>${match.color === 'w' ? 'white' : 'black'}</b>. Make your move, then send the reply link back.</span></div>`;

      el.innerHTML = `
        <div class="chess-wrap">
          ${banner}
          <div class="chess-topbar">
            <div class="chess-status" id="cs">${match ? 'Your move.' : "Your move. You're white."}</div>
            ${match ? '' : `
            <div class="board-themes" id="c-diff">
              <span>Engine</span>
              ${DIFFS.map(d => `<button class="diff-pill${d === diff ? ' active' : ''}" data-diff="${d.id}">${d.name}</button>`).join('')}
            </div>`}
            <div class="board-themes" id="c-themes">
              <span>Board</span>
              ${THEMES.map(t => `<button class="theme-swatch" data-theme="${t.id}" title="${t.name}"><i style="background:${t.light}"></i><i style="background:${t.dark}"></i></button>`).join('')}
            </div>
          </div>
          <div class="chess-board" id="cb"></div>
          <div class="chess-actions" id="c-actions">
            ${match ? '' : '<button class="btn btn-ghost" id="c-resign">Resign</button><button class="btn btn-ghost" id="c-invite">Invite a friend</button>'}
          </div>
          <div id="c-linkslot" style="width:100%"></div>
        </div>`;
      const boardEl = el.querySelector('#cb');
      const statusEl = el.querySelector('#cs');
      const linkSlot = el.querySelector('#c-linkslot');

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
        const started = moveList.length > 0 && !over;
        ctx = null;
        start();
        toast(`New game vs the <b>${diffById(b.dataset.diff).name}</b> engine${started ? '. The old game was scrapped, not resigned' : ''}.`);
      });

      const legalFrom = sq => game.moves({ square: sq, verbose: true });

      const draw = () => {
        const board = game.board();
        const moves = sel ? legalFrom(sel) : [];
        const flip = match?.color === 'b';
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
      };

      const materialEdge = () => {
        let edge = 0;
        for (const row of game.board()) for (const p of row)
          if (p) edge += (p.color === 'w' ? 1 : -1) * PIECE_VAL[p.type];
        return edge;
      };

      const endGame = resigned => {
        over = true;
        if (match) {
          // friendly match: no points (client-side matches are honor games)
          const won = game.isCheckmate() && game.turn() !== match.color;
          const sub = game.isCheckmate()
            ? (won ? `Checkmate. You beat ${match.from}.` : `Checkmate. ${match.from} takes it.`)
            : 'Match drawn.';
          showResult(el, 0, sub + ' Friendly matches score no points.', () => { ctx = null; start(); });
          return;
        }
        let pts, label, sub;
        if (resigned) {
          pts = 5; label = 'Chess: resigned'; sub = 'Resigned. Sit back down tomorrow.';
        } else if (game.isCheckmate()) {
          const won = game.turn() === 'b';
          pts = won ? diff.win : 15;
          label = won ? `Chess: checkmate win (${diff.name})` : 'Chess: loss';
          sub = won ? `Checkmate. You beat the ${diff.name} engine.` : 'Checkmated. Review and requeue.';
        } else {
          pts = Math.max(20, Math.round((100 + materialEdge() * 5) * diff.drawScale));
          label = `Chess: draw (${diff.name})`;
          sub = 'Drawn game.';
        }
        finish(pts, label);
        showResult(el, pts, sub, start);
      };

      /* Engine: Easy plays random. Medium plays greedy captures. Hard looks one reply
         ahead and avoids moves that hang material or walk into mate. */
      const aiMove = () => {
        const moves = game.moves({ verbose: true });
        if (!moves.length) return endGame(false);
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
        moveList.push(best.from + best.to + (best.promotion || ''));
        lastMove = best;
        draw();
        if (game.isGameOver()) return endGame(false);
        statusEl.textContent = game.inCheck() ? 'Check. Your move.' : 'Your move.';
      };

      const myColor = () => match ? match.color : 'w';

      boardEl.addEventListener('click', e => {
        if (over || game.turn() !== myColor()) return;
        const sqEl = e.target.closest('[data-sq]');
        if (!sqEl) return;
        const sq = sqEl.dataset.sq;
        const piece = game.get(sq);

        if (sel && legalFrom(sel).some(m => m.to === sq)) {
          let mv = null;
          try { mv = game.move({ from: sel, to: sq, promotion: 'q' }); } catch { return; }
          moveList.push(mv.from + mv.to + (mv.promotion || ''));
          lastMove = mv; sel = null;
          draw();
          if (game.isGameOver()) return endGame(false);
          if (match) {
            over = true; // locked until the rival replies with their link
            statusEl.textContent = match.fresh ? 'Move made. Send the invite link.' : 'Move sent. Waiting on ' + match.from + '.';
            linkSlot.innerHTML = linkBox(
              match.fresh
                ? 'Send this invite link. Your friend plays black, moves, and sends a link back:'
                : 'Send this reply link. The match continues when they move:',
              chessLink(moveList));
            return;
          }
          statusEl.textContent = 'Engine thinking…';
          aiTimer = setTimeout(aiMove, 350 + Math.random() * 450);
        } else if (piece && piece.color === myColor()) {
          sel = sel === sq ? null : sq;
          draw();
        } else {
          sel = null;
          draw();
        }
      });

      el.querySelector('#c-resign')?.addEventListener('click', () => { if (!over) endGame(true); });
      // fresh match: reset the board, you play white, first move builds the invite link
      el.querySelector('#c-invite')?.addEventListener('click', () => {
        clearTimeout(aiTimer);
        ctx = { moves: [], from: 'your rival', fresh: true };
        start();
      });
      draw();
      // a link can arrive already decided (their move mated you, or a draw): show it
      if (match && game.isGameOver()) endGame(false);
    };

    start();
    return () => clearTimeout(aiTimer);
  },
});
