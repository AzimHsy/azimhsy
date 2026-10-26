// Generates the profile SVGs in assets/ (dark + light for each).
// Minimal, quiet colour: GitHub's own greys, soft lavender / rose / peach, one quiet motion per part.
// Text is converted to outlines so it renders the same everywhere — GitHub serves README images
// without web fonts. Motion is CSS / SMIL inside the SVG; reduced motion shows the final state.
// Numbers come from scripts/data/gh-stats.json (the GitHub GraphQL contributions query).
// Run: pnpm build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ot from 'opentype.js';
import * as si from 'simple-icons';

const opentype = ot.parse ? ot : ot.default;
const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scripts);
const out = path.join(root, 'assets');

const loadFont = (file) => opentype.parse(new Uint8Array(fs.readFileSync(path.join(scripts, 'fonts', file))).buffer);
const F = {
  regular: loadFont('Geist-Regular.ttf'),
  semi: loadFont('Geist-SemiBold.ttf'),
  mono: loadFont('GeistMono-Medium.ttf'),
  display: loadFont('BricolageGrotesque-Condensed-ExtraBold.ttf'),
};

const themes = {
  dark: {
    bg: '#0d1117', surface: '#151b23', fg: '#f0f6fc', muted: '#9198a1', faint: '#656c76', line: '#3d444d',
    levels: ['#151b23', '#28243f', '#40366a', '#76598f', '#d7a3b9'],
    accent: '#e7a8bf',
    stat: ['#c3b9ff', '#f0b8cb', '#f2d0a7', '#a8dcd6'],
    viz: ['#a8dcd6', '#f2d0a7', '#f0b8cb', '#c3b9ff'],
    glow: 0.16,
  },
  light: {
    bg: '#ffffff', surface: '#f6f8fa', fg: '#1f2328', muted: '#59636e', faint: '#818b98', line: '#d1d9e0',
    levels: ['#eff2f5', '#e4defc', '#c6b6f2', '#a07fd0', '#d9789f'],
    accent: '#d4688f',
    stat: ['#6f5bd9', '#c9527d', '#b7772a', '#2f8f86'],
    viz: ['#5fb3aa', '#e0a85c', '#e58aa9', '#9b8cf0'],
    glow: 0.1,
  },
};

// Selected Work, a 2×2 grid: a looping clip of the real site (assets/clip-<slug>.webp, recorded
// with scripts/record-clip.cjs) over a caption image built here, one per theme.
const WORK = [
  ['motionlab', 'motionlab.digital', 'Motion Lab', 'Film agency site with a reel you drag and throw', 'Next.js   Framer Motion   GSAP   Lenis'],
  ['homlux', 'homlux.nurfitriazim.com', 'Homlux', 'Scroll-driven homepage for an interior studio', 'Next.js   GSAP ScrollTrigger   Lenis   Design: Afdzal'],
  ['thstudio', 'thstudio.site', 'TH Studio', 'Portfolio for an art director that scrolls sideways', 'Next.js   GSAP ScrollTrigger   Lenis'],
  ['brave', 'bravemy.com', 'Brave', 'Kids’ playwear store with its own checkout and admin', 'Next.js   Supabase   toyyibPay   GSAP'],
];

// ---------- text → path ----------
// Own serializer: opentype 2.0's toPathData() emits NaN for some coordinates.
const num = (v) => String(Math.round(v * 10) / 10);
const pathData = (p) =>
  p.commands.map((c) => (c.type === 'Z' ? 'Z' : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v !== undefined).map(num).join(' '))).join('');

// charToGlyph, not stringToGlyphs: opentype 2.0 throws on Bricolage's GSUB (lookup type 6, format 2).
function shape(f, str, x, y, size, { tracking = 0, align = 'start' } = {}) {
  const scale = size / f.unitsPerEm;
  const glyphs = [...str].map((ch) => f.charToGlyph(ch));
  const adv = glyphs.map((g, i) => {
    let a = g.advanceWidth * scale;
    if (i < glyphs.length - 1) a += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale + tracking * size;
    return a;
  });
  const width = adv.reduce((a, b) => a + b, 0);
  let cx = align === 'end' ? x - width : align === 'middle' ? x - width / 2 : x;
  let d = '';
  glyphs.forEach((g, i) => {
    d += pathData(g.getPath(cx, y, size));
    cx += adv[i];
  });
  return { d, width };
}
const T = (f, str, x, y, size, fill, o = {}) => `<path d="${shape(f, str, x, y, size, o).d}" fill="${fill}"${o.attr ? ' ' + o.attr : ''}/>`;
const width = (f, str, size, o = {}) => shape(f, str, 0, 0, size, o).width;

const svg = (w, h, title, css, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
<title>${title}</title>
<style>${css}</style>
${body}
</svg>
`;
const reduce = (sel) => `@media (prefers-reduced-motion:reduce){${sel}{animation:none!important}}`;

function wrap(f, str, size, maxW) {
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && width(f, next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Odometer: each digit rolls up from 0 in its own window, once. The base style is the final
// value and the keyframes only say where it starts, so reduced motion shows the real number.
function counter(ctx, str, x, y, size, fill, delay, f) {
  const scale = size / f.unitsPerEm;
  const slot = Math.max(...[...'0123456789'].map((ch) => f.charToGlyph(ch).advanceWidth)) * scale;
  const lh = size * 1.1;
  let cx = x;
  let s = '';
  [...str].forEach((ch, i) => {
    if (!/\d/.test(ch)) {
      s += T(f, ch, cx, y, size, fill);
      cx += f.charToGlyph(ch).advanceWidth * scale;
      return;
    }
    const d = Number(ch);
    const id = `k${ctx.n++}`;
    let col = '';
    for (let k = 0; k <= d; k++) col += T(f, String(k), cx + (slot - f.charToGlyph(String(k)).advanceWidth * scale) / 2, y + k * lh, size, fill);
    ctx.defs += `<clipPath id="c${id}"><rect x="${num(cx)}" y="${num(y - size * 0.82)}" width="${num(slot)}" height="${num(size * 0.9)}"/></clipPath>`;
    s += `<g clip-path="url(#c${id})"><g class="odo ${id}">${col}</g></g>`;
    ctx.css.push(`.${id}{transform:translateY(-${num(d * lh)}px);animation:${id} ${(1.4 + i * 0.15).toFixed(2)}s cubic-bezier(.15,.75,.1,1) ${delay}s backwards}@keyframes ${id}{from{transform:translateY(0)}}`);
    cx += slot;
  });
  return { svg: s, width: cx - x };
}

// ---------- data ----------
const gh = JSON.parse(fs.readFileSync(path.join(scripts, 'data/gh-stats.json'), 'utf8')).data.user;
const cal = gh.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const days = weeks.flat();
const total = cal.totalContributions;
const activeDays = days.filter((d) => d.contributionCount > 0).length;
// Current streak, GitHub-style: a today with nothing yet doesn't break it (the daily refresh
// can run before the day's first commit).
let streak = 0;
for (const d of days.at(-1).contributionCount > 0 ? days : days.slice(0, -1)) streak = d.contributionCount > 0 ? streak + 1 : 0;
const months = [];
for (const d of days) {
  const m = d.date.slice(0, 7);
  if (months.at(-1)?.m !== m) months.push({ m, n: 0 });
  months.at(-1).n += d.contributionCount;
}
const bestMonth = months.slice(-12).reduce((a, b) => (b.n > a.n ? b : a));
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmt = (n) => n.toLocaleString('en-US');
const level = (() => {
  const counts = days.map((d) => d.contributionCount).filter((n) => n > 0).sort((a, b) => a - b);
  const q = (p) => counts[Math.floor(p * (counts.length - 1))];
  const cuts = [q(0.25), q(0.5), q(0.75)];
  return (n) => (n === 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);
})();

// ---------- hero: name, a quiet year of contributions, four numbers ----------
function hero(t) {
  const W = 1600;
  const H = 600;
  const ctx = { defs: '', css: [], n: 0 };
  let b = `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  ctx.defs += `<filter id="blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="90"/></filter>`;
  b += `<g filter="url(#blur)" opacity="${t.glow}"><circle class="g0" cx="1380" cy="60" r="230" fill="#8b7bff"/><circle class="g1" cx="1050" cy="260" r="180" fill="#ff8fb5"/></g>`;
  ctx.css.push(`.g0{animation:g0 18s ease-in-out infinite alternate}@keyframes g0{to{transform:translate(-120px,60px)}}.g1{animation:g1 22s ease-in-out infinite alternate}@keyframes g1{to{transform:translate(140px,-50px)}}`);

  b += T(F.semi, 'Nurfitri Azim', 0, 80, 76, t.fg, { tracking: -0.02 });
  b += T(F.regular, 'Designer who builds websites that move.', 0, 136, 32, t.muted);

  const st = 'Open for projects';
  const dx = W - width(F.regular, st, 24) - 22;
  b += `<circle class="halo" cx="${num(dx)}" cy="70" r="7" fill="${t.accent}"/><circle cx="${num(dx)}" cy="70" r="7" fill="${t.accent}"/>`;
  b += T(F.regular, st, W, 79, 24, t.muted, { align: 'end' });
  ctx.css.push(`.halo{transform-box:fill-box;transform-origin:center;animation:halo 2.4s ease-out infinite}@keyframes halo{from{transform:scale(1);opacity:.6}to{transform:scale(3);opacity:0}}`);

  const pitch = W / weeks.length;
  const cell = Math.round(pitch * 0.78);
  const gy = 200;
  const lastDay = days.at(-1).date;
  weeks.forEach((w, wi) =>
    w.forEach((d) => {
      const today = d.date === lastDay;
      const y = gy + new Date(`${d.date}T00:00:00Z`).getUTCDay() * pitch;
      b += `<rect${today ? ' class="today"' : ''} x="${num(wi * pitch)}" y="${num(y)}" width="${cell}" height="${cell}" rx="4" fill="${today ? t.accent : t.levels[level(d.contributionCount)]}"/>`;
    }),
  );
  ctx.css.push(`.today{animation:today 2.4s ease-in-out infinite}@keyframes today{50%{opacity:.35}}`);
  let lastMonth = '';
  weeks.forEach((w, wi) => {
    const mo = w[0].date.slice(5, 7);
    if (mo !== lastMonth && wi > 0 && wi < weeks.length - 2) b += T(F.regular, MONTH_SHORT[Number(mo) - 1], wi * pitch, gy + 7 * pitch + 24, 19, t.faint);
    lastMonth = mo;
  });

  const stats = [
    [fmt(total), 'contributions'],
    [String(activeDays), 'active days'],
    [String(streak), 'day streak'],
    [fmt(bestMonth.n), `in ${MONTH_LONG[Number(bestMonth.m.slice(5)) - 1]}`],
  ];
  stats.forEach(([v, label], i) => {
    const c = counter(ctx, v, i * 400, 560, 54, t.stat[i], 0.3 + i * 0.2, F.semi);
    b += c.svg + T(F.regular, label, i * 400 + c.width + 14, 560, 26, t.muted);
  });

  ctx.css.push(reduce('.halo,.today,.odo,.g0,.g1'));
  return svg(W, H, `Nurfitri Azim, designer who builds websites that move. ${fmt(total)} contributions in the last year.`, ctx.css.join(''), `<defs>${ctx.defs}</defs>${b}`);
}

// ---------- the caption under each clip: name, site, line and stack ----------
function caption(t, [, site, name, blurb, tags]) {
  const W = 800;
  const H = 164;
  let b = `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  b += T(F.semi, name, 0, 54, 38, t.fg);
  b += T(F.regular, site, W - 26, 52, 22, t.muted, { align: 'end' });
  const ax = W - 4;
  b += `<path d="M${ax - 13} 50L${ax} 37M${ax - 10} 37H${ax}V47" fill="none" stroke="${t.accent}" stroke-width="2.5"/>`;
  b += T(F.regular, blurb, 0, 98, 26, t.muted);
  b += T(F.mono, tags, 0, 140, 20, t.faint);
  return svg(W, H, `${name}: ${blurb}. Opens ${site}.`, '', b);
}

// ---------- what I do: three tiles, each with a small animation ----------
function services(t) {
  const W = 1600;
  const H = 420;
  const css = [];
  const [c1, c2, c3, c4] = t.viz;
  let b = `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  const tw = (W - 48) / 3;
  const y = 2;
  const items = [
    ['Online stores', 'Next.js with Supabase or Payload. Prices checked on the server, CHIP, toyyibPay or HitPay at checkout, Ninja Van shipping.'],
    ['Store revamps', 'Shopify, EasyStore and WooCommerce. Themes, custom sections, catalogue imports and full redesigns.'],
    ['Sites that move', 'Scroll-driven stories in GSAP and Framer Motion, designed in Figma first.'],
  ];
  items.forEach(([title, body], i) => {
    const x = 1 + i * (tw + 24);
    b += `<rect x="${num(x)}" y="${y}" width="${num(tw - 2)}" height="${H - 4}" rx="20" fill="${t.surface}" stroke="${t.line}" stroke-width="2"/>`;
    const vx = x + 40;
    const vw = tw - 80;
    if (i === 0) {
      // an order moving from cart to paid to shipped
      const cy = y + 86;
      const xs = [vx + 24, vx + vw / 2, vx + vw - 24];
      b += `<rect x="${num(xs[0])}" y="${cy - 2}" width="${num(xs[2] - xs[0])}" height="4" rx="2" fill="${t.line}"/>`;
      b += `<rect class="ckl" x="${num(xs[0])}" y="${cy - 2}" width="${num(xs[2] - xs[0])}" height="4" rx="2" fill="${c2}"/>`;
      css.push(`.ckl{transform-box:fill-box;transform-origin:0 50%;animation:ckl 4.5s cubic-bezier(.6,0,.3,1) infinite}@keyframes ckl{0%,12%{transform:scaleX(0)}40%{transform:scaleX(.5)}68%,88%{transform:scaleX(1)}100%{transform:scaleX(0)}}`);
      [['Cart', c1, 10], ['Paid', c2, 38], ['Shipped', c3, 66]].forEach(([label, col, at], k) => {
        b += `<circle cx="${num(xs[k])}" cy="${cy}" r="16" fill="${t.surface}" stroke="${t.line}" stroke-width="2"/>`;
        b += `<circle class="ck${k}" cx="${num(xs[k])}" cy="${cy}" r="16" fill="${col}"/>`;
        css.push(`.ck${k}{animation:ck${k} 4.5s ease infinite}@keyframes ck${k}{0%,${at}%{opacity:0}${at + 4}%,90%{opacity:1}100%{opacity:0}}`);
        b += T(F.regular, label, xs[k], cy + 48, 20, t.muted, { align: 'middle' });
      });
    } else if (i === 1) {
      // a small storefront cycling through themes
      const pal = [c4, c1, c2, c3];
      b += `<rect class="rv0" x="${num(vx)}" y="${y + 44}" width="${num(vw)}" height="14" rx="7" fill="${pal[0]}"/>`;
      const pw = (vw - 32) / 3;
      for (let k = 0; k < 3; k++) {
        b += `<rect class="rv${k + 1}" x="${num(vx + k * (pw + 16))}" y="${y + 72}" width="${num(pw)}" height="62" rx="10" fill="${pal[k + 1]}"/>`;
        b += `<rect x="${num(vx + k * (pw + 16))}" y="${y + 144}" width="${num(pw * 0.7)}" height="7" rx="3.5" fill="${t.line}"/>`;
      }
      for (let k = 0; k < 4; k++) {
        const seq = [0, 1, 2, 3].map((s) => pal[(k + s) % 4]);
        css.push(`.rv${k}{animation:rv${k} 6s steps(1) infinite}@keyframes rv${k}{0%{fill:${seq[0]}}25%{fill:${seq[1]}}50%{fill:${seq[2]}}75%{fill:${seq[3]}}}`);
      }
    } else {
      // a dot easing along a curve, with its bezier handles
      const x0 = vx + 10;
      const y0 = y + 152;
      const w = vw - 20;
      const h = 108;
      const p1 = [x0 + 0.65 * w, y0];
      const p2 = [x0 + 0.35 * w, y0 - h];
      const p3 = [x0 + w, y0 - h];
      const d = `M${num(x0)} ${y0}C${num(p1[0])} ${p1[1]} ${num(p2[0])} ${p2[1]} ${num(p3[0])} ${p3[1]}`;
      b += `<path d="M${num(x0)} ${y0}H${num(x0 + w)}M${num(x0)} ${y0}V${y0 - h}" stroke="${t.line}" stroke-width="2" fill="none"/>`;
      b += `<path d="M${num(x0)} ${y0}L${num(p1[0])} ${p1[1]}M${num(p3[0])} ${p3[1]}L${num(p2[0])} ${p2[1]}" stroke="${c1}" stroke-width="2" fill="none" stroke-opacity=".7"/>`;
      b += `<rect x="${num(p1[0] - 6)}" y="${p1[1] - 6}" width="12" height="12" rx="2" fill="${c1}"/><rect x="${num(p2[0] - 6)}" y="${p2[1] - 6}" width="12" height="12" rx="2" fill="${c1}"/>`;
      b += `<path d="${d}" stroke="${t.muted}" stroke-width="3" fill="none"/>`;
      b += `<circle r="12" fill="${c3}"><animateMotion dur="2.6s" repeatCount="indefinite" path="${d}" keyPoints="0;1;1" keyTimes="0;.75;1" calcMode="spline" keySplines=".65 0 .35 1;0 0 1 1"/></circle>`;
    }
    b += T(F.display, title, x + 40, y + 232, 48, t.fg);
    wrap(F.regular, body, 23, tw - 80).forEach((ln, j) => (b += T(F.regular, ln, x + 40, y + 276 + j * 31, 23, t.muted)));
  });
  css.push(reduce('.ckl,.ck0,.ck1,.ck2,.rv0,.rv1,.rv2,.rv3'));
  return svg(W, H, items.map(([ti, d]) => `${ti}: ${d}`).join(' '), css.join(''), b);
}

// ---------- stack: three rows of chips sliding, alternating direction ----------
// Rows: frontend + motion, backend + data, mobile + commerce + tools.
// simple-icons has no Java or VS Code logo (both removed at the owners' request):
// Java uses the OpenJDK cup in Java orange, VS Code gets a plain </> mark.
const STACK = [
  [['HTML', si.siHtml5], ['CSS', si.siCss], ['JavaScript', si.siJavascript], ['TypeScript', si.siTypescript], ['React', si.siReact], ['Next.js', si.siNextdotjs], ['Tailwind CSS', si.siTailwindcss], ['GSAP', si.siGsap], ['Framer Motion', si.siFramer], ['Figma', si.siFigma]],
  [['Node.js', si.siNodedotjs], ['Express', si.siExpress], ['PHP', si.siPhp], ['Laravel', si.siLaravel], ['Java', { ...si.siOpenjdk, hex: 'F89820' }], ['Spring', si.siSpring], ['Supabase', si.siSupabase], ['PostgreSQL', si.siPostgresql], ['MySQL', si.siMysql], ['Payload CMS', si.siPayloadcms]],
  [['Expo', si.siExpo], ['Kotlin', si.siKotlin], ['Android', si.siAndroid], ['Flutter', si.siFlutter], ['Dart', si.siDart], ['Shopify', si.siShopify], ['WooCommerce', si.siWoocommerce], ['Cloudflare', si.siCloudflare], ['Docker', si.siDocker], ['Git', si.siGit], ['GitHub', si.siGithub], ['Postman', si.siPostman], ['VS Code', null]],
];
// brand colours that disappear on one of the backgrounds
const ICON_FIX = { dark: { Flutter: '#47c5fb' }, light: { JavaScript: '#c9a800' } };

function stack(t, mode) {
  const W = 1600;
  const H = 304;
  const css = [];
  const colour = (label, hex) => ICON_FIX[mode][label] ?? (['000000', '0A0A0A', '181717', '1C2024'].includes(hex.toUpperCase()) ? t.fg : `#${hex}`);
  const defs = `<linearGradient id="fade"><stop offset="0" stop-color="#000"/><stop offset=".06" stop-color="#fff"/><stop offset=".94" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="mk"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`;
  let b = `<rect width="${W}" height="${H}" fill="${t.bg}"/><g mask="url(#mk)">`;
  STACK.forEach((row, ri) => {
    const y = 8 + ri * 102;
    let x = 0;
    let chips = '';
    let rowW = 0;
    for (let copy = 0; copy < 2; copy++)
      row.forEach(([label, icon]) => {
        const w = 24 + 32 + 14 + width(F.regular, label, 25) + 28;
        chips += `<rect x="${num(x)}" y="${y}" width="${num(w)}" height="72" rx="36" fill="${t.surface}" stroke="${t.line}" stroke-width="2"/>`;
        chips += icon
          ? `<path d="${icon.path}" transform="translate(${num(x + 24)} ${y + 20}) scale(${(32 / 24).toFixed(4)})" fill="${colour(label, icon.hex)}"/>`
          : T(F.mono, '</>', x + 24 + 16, y + 45, 20, '#3b9ee8', { align: 'middle' });
        chips += T(F.regular, label, x + 24 + 32 + 14, y + 45, 25, t.fg, { attr: 'fill-opacity=".9"' });
        x += w + 16;
        if (copy === 0) rowW = x;
      });
    // same speed on every row, whatever its length
    const dur = (rowW / 40).toFixed(1);
    const rtl = ri % 2 === 0;
    b += `<g class="mq${ri}">${chips}</g>`;
    css.push(
      rtl
        ? `.mq${ri}{animation:mq${ri} ${dur}s linear infinite}@keyframes mq${ri}{to{transform:translateX(-${num(rowW)}px)}}`
        : `.mq${ri}{transform:translateX(-${num(rowW)}px);animation:mq${ri} ${dur}s linear infinite}@keyframes mq${ri}{from{transform:translateX(-${num(rowW)}px)}to{transform:translateX(0)}}`,
    );
  });
  b += '</g>';
  css.push(reduce('.mq0,.mq1,.mq2'));
  return svg(W, H, `Stack: ${STACK.flat().map(([l]) => l).join(', ')}`, css.join(''), `<defs>${defs}</defs>${b}`);
}

// ---------- footer: the ask and the email ----------
function footer(t) {
  const W = 1600;
  const H = 150;
  let b = `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  b += `<path d="M0 1H${W}" stroke="${t.line}" stroke-width="2"/>`;
  b += T(F.semi, 'Got a store to build?', 0, 96, 44, t.fg);
  const mail = 'hello@nurfitriazim.com';
  const mw = width(F.regular, mail, 28);
  const pw = mw + 100;
  const px = W - pw;
  b += `<rect x="${num(px)}" y="40" width="${num(pw)}" height="76" rx="38" fill="${t.accent}" fill-opacity=".12" stroke="${t.accent}" stroke-opacity=".55" stroke-width="2"/>`;
  b += T(F.regular, mail, px + 36, 88, 28, t.fg);
  const ax = px + 36 + mw + 18;
  b += `<path d="M${num(ax)} 90L${num(ax + 16)} 74M${num(ax + 3)} 74H${num(ax + 16)}V87" fill="none" stroke="${t.fg}" stroke-width="2.5"/>`;
  return svg(W, H, 'Got a store to build? Email hello@nurfitriazim.com', '', b);
}

for (const f of fs.readdirSync(out).filter((f) => f.endsWith('.svg'))) fs.unlinkSync(path.join(out, f));
for (const [mode, t] of Object.entries(themes)) {
  fs.writeFileSync(path.join(out, `hero-${mode}.svg`), hero(t));
  WORK.forEach((w) => fs.writeFileSync(path.join(out, `caption-${w[0]}-${mode}.svg`), caption(t, w)));
  fs.writeFileSync(path.join(out, `services-${mode}.svg`), services(t));
  fs.writeFileSync(path.join(out, `stack-${mode}.svg`), stack(t, mode));
  fs.writeFileSync(path.join(out, `footer-${mode}.svg`), footer(t));
}
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB');
