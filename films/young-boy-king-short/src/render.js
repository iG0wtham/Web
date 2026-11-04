// Render driver for the Shorts cut (1080x1920).
//   node render.js stills <outdir> t1 t2 ...    → PNG frames at those times
//   node render.js video <out.mp4> [from] [to]  → silent H.264, 30 fps
// Env: SCALE (WebGL render scale, default 0.75), FPS (default 30)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const TIMING = JSON.parse(fs.readFileSync(path.join(root, 'audio', 'timing.json'), 'utf8'));
const FPS = +(process.env.FPS || 30), SCALE = +(process.env.SCALE || 0.75);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const [mode, outp, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(([tm, sc]) => { window.TIMING = tm; window.RENDER_SCALE = sc; }, [TIMING, SCALE]);
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 300000 });

  if (mode === 'stills') {
    fs.mkdirSync(outp, { recursive: true });
    for (const s of rest) {
      const t = parseFloat(s), t0 = Date.now();
      await page.evaluate(t => window.drawFrame(t), t);
      await page.screenshot({ path: path.join(outp, `t${t.toFixed(2).padStart(6, '0')}.png`) });
      console.log('still', t, (Date.now() - t0) + 'ms');
    }
  } else {
    const from = parseFloat(rest[0] ?? 0), to = parseFloat(rest[1] ?? TIMING.duration);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), outp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS), t0 = Date.now();
    for (let f = n0; f < n1; f++) {
      await page.evaluate(t => window.drawFrame(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) console.log(`frame ${f}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close(); server.close();
})();
