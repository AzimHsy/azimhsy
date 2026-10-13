// Generates the profile SVGs in assets/ (dark + light for each).
// Text is converted to outlines (Geist) so it renders the same on every machine —
// GitHub serves README images without web fonts.
// Run: pnpm build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ot from 'opentype.js';
import * as si from 'simple-icons';

const opentype = ot.parse ? ot : ot.default;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'assets');
const fontDir = path.join(root, 'scripts/fonts');

const loadFont = (file) => opentype.parse(new Uint8Array(fs.readFileSync(path.join(fontDir, file))).buffer);
const font = {
  regular: loadFont('Geist-Regular.ttf'),
  semibold: loadFont('Geist-SemiBold.ttf'),
};

// GitHub's own palette, so the images sit in the page like native widgets.
// levels = contribution-graph greens, empty → most.
const themes = {
  dark: {
    bg: '#0d1117', fg: '#f0f6fc', soft: '#d1d7e0', muted: '#9198a1', line: '#3d444d',
    levels: ['#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364'],
  },
  light: {
    bg: '#ffffff', fg: '#1f2328', soft: '#31373d', muted: '#59636e', line: '#d1d9e0',
    levels: ['#eff2f5', '#aceebb', '#4ac26b', '#2da44e', '#116329'],
  },
};

// ---------- text → path ----------
// Own serializer: opentype 2.0's toPathData() emits NaN for some coordinates.
const num = (v) => String(Math.round(v * 10) / 10);
const pathData = (p) =>
  p.commands.map((c) => (c.type === 'Z' ? 'Z' : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v !== undefined).map(num).join(' '))).join('');

// tracking is in em. align: 'start' | 'end'. Returns { d, width }.
function text(f, str, x, y, size, { tracking = 0, align = 'start' } = {}) {
  const scale = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(str);
  const advances = glyphs.map((g, i) => {
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) adv += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale + tracking * size;
    return adv;
  });
  const width = advances.reduce((a, b) => a + b, 0);
  let cx = align === 'end' ? x - width : x;
  let d = '';
  glyphs.forEach((g, i) => {
    d += pathData(g.getPath(cx, y, size));
    cx += advances[i];
  });
  return { d, width };
}

const svg = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
<title>${title}</title>
${body}
</svg>
`;

const card = (w, h, t) =>
  `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="12" fill="${t.bg}" stroke="${t.line}" stroke-width="2"/>`;

// ---------- pixel letters (5×7, like the contribution graph's 7 rows) ----------
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
};

// Returns the set of lit cells ("col,row") for a word, and its width in columns.
function spell(word) {
  const on = new Set();
  let col = 0;
  for (const ch of word) {
    const g = GLYPHS[ch];
    g.forEach((row, r) => [...row].forEach((v, c) => v === '#' && on.add(`${col + c},${r}`)));
    col += g[0].length + 1;
  }
  return { on, width: col - 1 };
}

// Seeded so every build draws the same "activity".
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const PITCH = 1428 / 53; // 53 weeks across the banner's grid area
const SQ = 21;

// ---------- banner: a year of contributions with the name lit up ----------
function banner(t) {
  const W = 1600, H = 486, x0 = 116, y0 = 214, COLS = 53, TODAY_ROW = 3; // Wednesday
  const rand = rng(14);
  const name = spell('AZIM');
  const start = Math.floor((COLS - name.width) / 2);
  const lit = new Set([...name.on].map((k) => { const [c, r] = k.split(',').map(Number); return `${c + start},${r}`; }));

  const title = text(font.semibold, 'Nurfitri Azim', 56, 96, 40);
  const sub = text(font.regular, 'Full-stack developer & UI/UX designer · Kuala Lumpur, Malaysia', 56, 138, 22);
  const open = text(font.regular, 'Open for projects', 1544, 94, 22, { align: 'end' });
  const note = text(font.regular, 'Most of my work lives in private client repos.', x0, 452, 18);

  // Month labels: column 52 is the week of 11 Oct 2026.
  const months = [];
  let prev = -1, lastCol = -9;
  for (let c = 0; c < COLS; c++) {
    const d = new Date(Date.UTC(2026, 9, 11) - (52 - c) * 7 * 864e5);
    const m = d.getUTCMonth();
    if (m !== prev && c - lastCol >= 3) {
      months.push(text(font.regular, d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }), x0 + c * PITCH, y0 - 18, 17).d);
      lastCol = c;
    }
    prev = m;
  }
  const days = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([r, l]) => text(font.regular, l, 56, y0 + r * PITCH + 16, 17).d);

  const cells = [];
  const live = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < 7; r++) {
      if (c === COLS - 1 && r > TODAY_ROW) continue; // the rest of this week hasn't happened yet
      const key = `${c},${r}`;
      const near = c >= start - 1 && c <= start + name.width;
      let level = 0;
      if (lit.has(key)) level = 4;
      else if (near) level = 0; // keep the name's surroundings clean so it reads
      else if (rand() < 0.42) { const v = rand(); level = v < 0.55 ? 1 : v < 0.86 ? 2 : 3; }
      const x = (x0 + c * PITCH).toFixed(1), y = (y0 + r * PITCH).toFixed(1);
      // Background squares land first in a left-to-right sweep, then the name.
      const delay = level === 4 ? 1500 + (c - start) * 45 + r * 12 : c * 24 + r * 5;
      let cls = 'c';
      if (level !== 4 && !near && rand() < 0.05) { cls = `c live${level >= 2 ? 'down' : 'up'}`; live.push(1); }
      const liveDelay = cls === 'c' ? '' : `,${(3 + rand() * 6).toFixed(1)}s`;
      cells.push(`<rect class="${cls}" x="${x}" y="${y}" width="${SQ}" height="${SQ}" rx="4" fill="${t.levels[level]}" style="animation-delay:${delay}ms${liveDelay}"/>`);
    }
  }

  const legendX = 1544 - 5 * 26 - 46;
  const less = text(font.regular, 'Less', legendX - 10, 452, 18, { align: 'end' });
  const more = text(font.regular, 'More', legendX + 5 * 26 + 6, 452, 18);
  const legend = t.levels.map((col, i) => `<rect x="${legendX + i * 26}" y="438" width="18" height="18" rx="4" fill="${col}"/>`).join('');

  return svg(W, H, 'Nurfitri Azim — full-stack developer and UI/UX designer. A contribution graph with the name AZIM lit up.', `
<style>
  .c { animation: land .5s ease-out both; }
  .liveup { animation: land .5s ease-out both, up 7s ease-in-out infinite; }
  .livedown { animation: land .5s ease-out both, down 7s ease-in-out infinite; }
  @keyframes land { from { fill: ${t.levels[0]}; } }
  @keyframes up { 0%, 30%, 100% { } 55%, 75% { fill: ${t.levels[3]}; } }
  @keyframes down { 0%, 30%, 100% { } 55%, 75% { fill: ${t.levels[0]}; } }
  .dot { animation: dot 2.4s ease-in-out infinite; }
  @keyframes dot { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .c, .liveup, .livedown, .dot { animation: none; } }
</style>
${card(W, H, t)}
<path d="${title.d}" fill="${t.fg}"/>
<path d="${sub.d}" fill="${t.muted}"/>
<circle class="dot" cx="${(1544 - open.width - 18).toFixed(1)}" cy="87" r="7" fill="${t.levels[3]}"/>
<path d="${open.d}" fill="${t.soft}"/>
<g fill="${t.muted}">${months.map((d) => `<path d="${d}"/>`).join('')}${days.map((d) => `<path d="${d}"/>`).join('')}</g>
${cells.join('\n')}
<path d="${note.d}" fill="${t.muted}"/>
<g fill="${t.muted}"><path d="${less.d}"/><path d="${more.d}"/></g>
${legend}`);
}

// ---------- stack grid ----------
const stack = [
  ['Next.js', si.siNextdotjs], ['React', si.siReact], ['TypeScript', si.siTypescript],
  ['Tailwind CSS', si.siTailwindcss], ['Supabase', si.siSupabase], ['Payload CMS', si.siPayloadcms],
  ['PostgreSQL', si.siPostgresql], ['Cloudflare', si.siCloudflare], ['GSAP', si.siGsap],
  ['Framer Motion', si.siFramer], ['Shopify', si.siShopify], ['Figma', si.siFigma],
];

function stackGrid(t) {
  const W = 1600, cols = 6, cw = W / cols, ch = 184, H = ch * 2;
  let lines = '';
  for (let c = 1; c < cols; c++) lines += `<path d="M${(c * cw).toFixed(1)} 0V${H}" stroke="${t.line}" stroke-width="2"/>`;
  lines += `<path d="M0 ${ch}H${W}" stroke="${t.line}" stroke-width="2"/>`;

  const cells = stack.map(([label, icon], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const idx = text(font.regular, String(i + 1).padStart(2, '0'), x + cw - 28, y + 46, 18, { tracking: 0.1, align: 'end' });
    const name = text(font.regular, label, x + 28, y + 156, 24);
    return `<g>
  <path d="${idx.d}" fill="${t.muted}"/>
  <path d="${icon.path}" transform="translate(${(x + 28).toFixed(1)} ${y + 30}) scale(${(56 / 24).toFixed(4)})" fill="${t.fg}"/>
  <path d="${name.d}" fill="${t.soft}"/>
</g>`;
  }).join('\n');

  return svg(W, H, `Stack: ${stack.map(([l]) => l).join(', ')}`, `
<clipPath id="c"><rect width="${W}" height="${H}" rx="12"/></clipPath>
${card(W, H, t)}
<g clip-path="url(#c)">${lines}
${cells}
</g>`);
}

// ---------- footer: SAY HI in contribution squares, on a loop ----------
function footer(t) {
  const W = 1600, H = 300, x0 = 56, y0 = 58;
  const word = spell('SAY HI');
  const COLS = word.width + 2; // one empty column either side
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < 7; r++) {
      const on = word.on.has(`${c - 1},${r}`);
      const x = (x0 + c * PITCH).toFixed(1), y = (y0 + r * PITCH).toFixed(1);
      cells.push(on
        ? `<rect class="say" x="${x}" y="${y}" width="${SQ}" height="${SQ}" rx="4" fill="${t.levels[4]}" style="animation-delay:${c * 40 + r * 10}ms"/>`
        : `<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" rx="4" fill="${t.levels[0]}"/>`);
    }
  }
  const tx = 1000;
  const head = text(font.semibold, 'Got a store to build?', tx, 124, 40);
  const mail = text(font.regular, 'hello@nurfitriazim.com', tx, 182, 30);
  const site = text(font.regular, 'nurfitriazim.com · Kuala Lumpur', tx, 226, 20);
  const ax = tx + mail.width + 14;

  return svg(W, H, 'Say hi — hello@nurfitriazim.com', `
<style>
  .say { animation: say 9s ease-in-out infinite both; }
  @keyframes say {
    0%, 4% { fill: ${t.levels[0]}; }
    9% { fill: ${t.levels[2]}; }
    14%, 82% { fill: ${t.levels[4]}; }
    92%, 100% { fill: ${t.levels[0]}; }
  }
  @media (prefers-reduced-motion: reduce) { .say { animation: none; } }
</style>
${card(W, H, t)}
${cells.join('\n')}
<path d="${head.d}" fill="${t.fg}"/>
<path d="${mail.d}" fill="${t.fg}"/>
<path d="M${ax} 182L${ax + 20} 162M${ax + 4} 162H${ax + 20}V178" fill="none" stroke="${t.fg}" stroke-width="2.5"/>
<path d="${site.d}" fill="${t.muted}"/>`);
}

fs.mkdirSync(out, { recursive: true });
for (const [mode, t] of Object.entries(themes)) {
  fs.writeFileSync(path.join(out, `banner-${mode}.svg`), banner(t));
  fs.writeFileSync(path.join(out, `stack-${mode}.svg`), stackGrid(t));
  fs.writeFileSync(path.join(out, `footer-${mode}.svg`), footer(t));
}
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB');
