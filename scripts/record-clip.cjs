// Records a site animating and writes a looping animated WebP for Selected Work.
// Frames come from Chrome's own screencast (no ffmpeg); sharp encodes them.
// Not part of `pnpm build` — clips are recorded once and committed.
//
// Setup (once, not saved to package.json):  npm i --no-save playwright-core sharp
// usage: node scripts/record-clip.cjs <url> <out.webp> <scroll|hscroll|drag|none> <seconds>
//          [width=560] [fps=12] [quality=50] [warmup s=2.5] [wheel px=60] [corner radius px=11]
//
// The clips in assets/ (26 Oct 2026):
//   node scripts/record-clip.cjs https://www.motionlab.digital/work assets/clip-motionlab.webp scroll 4 560 12 50 3 60 11
//   node scripts/record-clip.cjs https://homlux.nurfitriazim.com    assets/clip-homlux.webp    scroll 4 560 12 50 2.5 50 11
//   node scripts/record-clip.cjs https://thstudio.site              assets/clip-thstudio.webp  scroll 4 560 12 50 2.5 70 11
//   node scripts/record-clip.cjs https://bravemy.com                assets/clip-brave.webp     scroll 4 560 12 50 2.5 60 11
// Look at the frames it saves next to the clip before committing: a page that ignores the
// wheel records a still (Motion Lab's home did; its /work page moves).
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const [url, outFile, mode = 'scroll', secs = '4', width = '560', fps = '12', quality = '50', warm = '2.5', wheel = '60', radius = '11'] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = Number(width);
const H = Math.round((W * 10) / 16);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    // some sites never go network-idle; record anyway
  }
  await page.waitForTimeout(Number(warm) * 1000);

  const cdp = await page.context().newCDPSession(page);
  const painted = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    painted.push({ t: metadata.timestamp, data });
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1440, maxHeight: 900 });

  await page.mouse.move(720, 450);
  const end = Date.now() + Number(secs) * 1000;
  while (Date.now() < end) {
    if (mode === 'drag') {
      await page.mouse.down();
      for (let i = 0; i < 14; i++) await page.mouse.move(900 - i * 45, 450, { steps: 1 });
      await page.mouse.up();
      await page.waitForTimeout(1100);
    } else if (mode === 'none') {
      await page.waitForTimeout(100);
    } else {
      await page.mouse.wheel(0, Number(wheel));
      await page.waitForTimeout(50);
    }
  }
  await page.waitForTimeout(300);
  await cdp.send('Page.stopScreencast');
  await browser.close();
  if (painted.length < 2) throw new Error(`Only ${painted.length} frames painted`);

  // Chrome paints only when something changes: resample to a steady rate by taking,
  // at each tick, the latest frame painted so far.
  const t0 = painted[0].t;
  const n = Math.floor(Number(secs) * Number(fps));
  const picked = [];
  for (let i = 0, j = 0; i < n; i++) {
    while (j + 1 < painted.length && painted[j + 1].t <= t0 + i / Number(fps)) j++;
    picked.push(painted[j].data);
  }

  // rounded corners as transparency, so the clip sits on either GitHub theme
  const R = Number(radius);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${R}" fill="#fff"/></svg>`);
  const frames = await Promise.all(
    picked.map((b64) => {
      const img = sharp(Buffer.from(b64, 'base64')).resize(W, H, { fit: 'cover', position: 'top' });
      return (R ? img.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]) : img).png().toBuffer();
    }),
  );
  const checkDir = outFile.replace(/\.webp$/, '-frames');
  fs.rmSync(checkDir, { recursive: true, force: true });
  fs.mkdirSync(checkDir);
  [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].forEach((k, i) => fs.writeFileSync(path.join(checkDir, `f${i}.png`), frames[k]));

  await sharp(frames, { join: { animated: true } })
    .webp({ quality: Number(quality), effort: 6, loop: 0, delay: frames.map(() => Math.round(1000 / Number(fps))), smartSubsample: true })
    .toFile(outFile);
  console.log(`${path.basename(outFile)}: ${painted.length} painted → ${n} frames, ${W}x${H} @${fps}fps q${quality}, ${Math.round(fs.statSync(outFile).size / 1024)} KB · check ${checkDir}`);
})();
