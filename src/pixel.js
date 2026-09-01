/* Pixel-art dart + gun logo, drawn on a 26x26 grid and rendered as SVG. */

const PALETTE = {
  G: '#5f6f66', // gun body (slate green)
  H: '#8a9a90', // gun highlight
  o: '#15803d', // deep green accent
  D: '#22c55e', // dart shaft (green)
  t: '#c8d3cb', // dart tip (silver)
  F: '#a3e635', // dart fins (lime)
};

/** Generic pixel-map renderer: rows of chars -> crisp SVG rects. */
export function rowsToSVG(rows, palette, { size = '1em', animated = false } = {}) {
  const cell = 10, h = rows.length, w = rows[0].length;
  let rects = '', n = 0;
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!palette[c]) return;
    const delay = animated ? ` style="animation-delay:${(n * 7) % 900}ms"` : '';
    rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${palette[c]}"${animated ? ' class="pxl"' : ''}${delay}/>`;
    n++;
  }));
  return `<svg viewBox="0 0 ${w * cell} ${h * cell}" width="${size}" height="${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function buildGrid() {
  const N = 26;
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const px = (x, y, c) => { if (y >= 0 && y < N && x >= 0 && x < N) g[y][x] = c; };

  // dart: diagonal from bottom-left tail to top-right tip (drawn first, gun overlaps).
  // The line crosses mid-slide so the tip stays clear of the gun's gold muzzle.
  for (let i = 0; i < 21; i++) {
    px(1 + i, 22 - i, 'D');
    px(2 + i, 22 - i, 'D');
  }
  // tip (silver point)
  px(23, 1, 't'); px(24, 1, 't');
  px(24, 0, 't'); px(25, 0, 't');
  // fins (chunky lime triangle at the tail)
  px(0, 25, 'F'); px(1, 25, 'F'); px(2, 25, 'F'); px(3, 25, 'F');
  px(0, 24, 'F'); px(1, 24, 'F'); px(2, 24, 'F');
  px(0, 23, 'F'); px(1, 23, 'F');
  px(0, 22, 'F');

  // gun: pistol facing right, stamped over the dart (rows of 16 chars, offset 5,8)
  const gun = [
    '##############oo',
    'HHHHHHHHHHHHHHoo',
    '################',
    '############....',
    '...#####..##....',
    '...#####.o.#....',
    '..#####....#....',
    '..#####.####....',
    '.#####..........',
    '.#####..........',
    '.ooooo..........',
  ];
  const gx = 5, gy = 8;
  gun.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '#') px(gx + x, gy + y, 'G');
    else if (c === 'H') px(gx + x, gy + y, 'H');
    else if (c === 'o') px(gx + x, gy + y, 'o');
  }));

  return g;
}

const GRID = buildGrid();

/** Render the logo as inline SVG. animated=true staggers each pixel in. */
export function logoSVG(size = 32, animated = false) {
  return rowsToSVG(GRID.map(r => r.join('')), PALETTE, { size, animated });
}

export function setFavicon() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(logoSVG(64));
  document.head.appendChild(link);
}
