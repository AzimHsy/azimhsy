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
  light: loadFont('Geist-Light.ttf'),
  regular: loadFont('Geist-Regular.ttf'),
  semibold: loadFont('Geist-SemiBold.ttf'),
};

const themes = {
  dark: { bg: '#0a0a0a', fg: '#f5f5f5', soft: '#cfcfcf', muted: '#7a7a7a', line: '#262626' },
  light: { bg: '#f4f4f2', fg: '#0a0a0a', soft: '#2e2e2e', muted: '#6e6e6e', line: '#dad9d5' },
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

const card = (w, h, t, id) =>
  `<clipPath id="${id}"><rect width="${w}" height="${h}" rx="18"/></clipPath>
<rect width="${w}" height="${h}" rx="18" fill="${t.bg}"/>`;

// ---------- banner ----------
function banner(t) {
  const W = 1600, H = 640;
  const name = text(font.regular, 'Nurfitri Azim', 56, 86, 30);
  const where = text(font.regular, '(KUALA LUMPUR, MALAYSIA)', 1544, 84, 20, { tracking: 0.14, align: 'end' });
  const role1 = text(font.light, 'Full-stack Developer &', 1040, 222, 34);
  const role2 = text(font.light, 'UI/UX Designer', 1040, 266, 34);
  const open = text(font.regular, 'OPEN FOR PROJECTS', 1064, 322, 18, { tracking: 0.14 });

  // Giant marquee, like the hero on nurfitriazim.com
  const big = text(font.semibold, 'NURFITRI AZIM — ', 0, 0, 270, { tracking: -0.025 });
  const span = Math.round(big.width);

  return svg(W, H, 'Nurfitri Azim — Full-stack Developer and UI/UX Designer, Kuala Lumpur', `
<style>
  .marquee { animation: marquee 24s linear infinite; }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-${span}px); } }
  .plus { transform-box: fill-box; transform-origin: center; animation: plus 6s cubic-bezier(.7,0,.2,1) infinite; }
  @keyframes plus { 0%, 65% { transform: rotate(0deg); } 85%, 100% { transform: rotate(90deg); } }
  .underline { transform-box: fill-box; transform-origin: left center; animation: underline 6s infinite; }
  @keyframes underline {
    0% { transform: translateX(0) scaleX(0); animation-timing-function: cubic-bezier(.7,0,.2,1); }
    18%, 62% { transform: translateX(0) scaleX(1); animation-timing-function: cubic-bezier(.7,0,.2,1); }
    80%, 100% { transform: translateX(${name.width.toFixed(1)}px) scaleX(0); }
  }
  .dot { animation: dot 2.4s ease-in-out infinite; }
  @keyframes dot { 50% { opacity: .25; } }
  @media (prefers-reduced-motion: reduce) { .marquee, .plus, .underline, .dot { animation: none; } }
</style>
<defs><path id="big" d="${big.d}"/></defs>
${card(W, H, t, 'c')}
<g clip-path="url(#c)">
  <path d="${name.d}" fill="${t.fg}"/>
  <rect class="underline" x="56" y="98" height="2" width="${name.width.toFixed(1)}" fill="${t.fg}"/>
  <path d="${where.d}" fill="${t.muted}"/>
  <g class="plus"><rect x="318" y="196" width="84" height="10" fill="${t.fg}"/><rect x="355" y="159" width="10" height="84" fill="${t.fg}"/></g>
  <path d="${role1.d}" fill="${t.soft}"/>
  <path d="${role2.d}" fill="${t.soft}"/>
  <circle class="dot" cx="1047" cy="316" r="6" fill="${t.fg}"/>
  <path d="${open.d}" fill="${t.muted}"/>
  <g transform="translate(-420 606)">
    <g class="marquee" fill="${t.fg}">
      <use href="#big"/>
      <use href="#big" x="${span}"/>
    </g>
  </g>
</g>`);
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
${card(W, H, t, 'c')}
<g clip-path="url(#c)">${lines}
${cells}
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="${t.line}" stroke-width="2"/>`);
}

// ---------- footer ----------
function footer(t) {
  const W = 1600, H = 340;
  const label = text(font.regular, '(CONTACT)', 56, 80, 20, { tracking: 0.14 });
  const mail = text(font.regular, 'hello@nurfitriazim.com', 1500, 82, 28, { align: 'end' });
  const big = text(font.semibold, 'LET’S WORK TOGETHER — ', 0, 0, 190, { tracking: -0.025 });
  const span = Math.round(big.width);

  return svg(W, H, 'Let’s work together — hello@nurfitriazim.com', `
<style>
  .marquee { animation: marquee 26s linear infinite; }
  @keyframes marquee { from { transform: translateX(-${span}px); } to { transform: translateX(0); } }
  @media (prefers-reduced-motion: reduce) { .marquee { animation: none; } }
</style>
<defs><path id="big" d="${big.d}"/></defs>
${card(W, H, t, 'c')}
<g clip-path="url(#c)">
  <path d="${label.d}" fill="${t.muted}"/>
  <path d="${mail.d}" fill="${t.fg}"/>
  <path d="M1518 86L1542 62M1522 62H1542V82" fill="none" stroke="${t.fg}" stroke-width="3"/>
  <path d="M56 122H1544" stroke="${t.line}" stroke-width="2"/>
  <g transform="translate(0 302)">
    <g class="marquee" fill="${t.fg}">
      <use href="#big"/>
      <use href="#big" x="${span}"/>
      <use href="#big" x="${span * 2}"/>
    </g>
  </g>
</g>`);
}

fs.mkdirSync(out, { recursive: true });
for (const [mode, t] of Object.entries(themes)) {
  fs.writeFileSync(path.join(out, `banner-${mode}.svg`), banner(t));
  fs.writeFileSync(path.join(out, `stack-${mode}.svg`), stackGrid(t));
  fs.writeFileSync(path.join(out, `footer-${mode}.svg`), footer(t));
}
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB');
