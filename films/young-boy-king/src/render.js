// Render driver.
//   node render.js stills <outdir> t1 t2 ...   → PNG style frames at those times
//   node render.js video <out.mp4> [from] [to] → silent H.264 video, 24 fps
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

const here = __dirname;
const TL = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const linesMeta = JSON.parse(fs.readFileSync(path.join(here, '..', 'audio', 'voice', 'lines.json'), 'utf8'));
const LINES = linesMeta.map((l, i) => ({ start: TL.lines[i], dur: l.dur, sub: l.sub }));

(async () => {
  const [mode, outp, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: (process.env.NOGPU ? ['--disable-gpu', '--disable-accelerated-2d-canvas'] : ['--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-vsync']) });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript(tl => { window.TL = tl; }, TL);
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await page.goto('file://' + path.join(here, 'film.html'));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  await page.evaluate(ls => window.setLines(ls), LINES);
  const canvas = await page.$('#out');

  if (mode === 'stills') {
    fs.mkdirSync(outp, { recursive: true });
    for (const s of rest) {
      const t = parseFloat(s);
      await page.evaluate(t => window.drawFrame(t), t);
      await canvas.screenshot({ path: path.join(outp, `t${t.toFixed(2).padStart(6, '0')}.png`) });
      console.log('still', t);
    }
  } else {
    const fps = TL.fps, from = parseFloat(rest[0] ?? 0), to = parseFloat(rest[1] ?? TL.duration);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), outp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
    const t0 = Date.now();
    for (let f = n0; f < n1; f++) {
      await page.evaluate(t => window.drawFrame(t), f / fps);
      const buf = await canvas.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 48 === 0) console.log(`frame ${f}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
