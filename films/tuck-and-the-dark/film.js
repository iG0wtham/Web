// "Tuck and the Dark" — a crayon picture book page that travels left to right.
// Engine (gl.js, crayon.js, rig.js) from the Lemo-Opuscar Crayon Picture Book style; story, characters, page and timeline are this film's.
import { layer, clear, line, fill, dab, text, handCircle, ellipse, smooth, xf, CAM, BOIL, W, H, sx, sy } from './crayon.js';
import { group, clearGroup, part, tube, erase } from './rig.js';
import { clamp, lerp, hash, track, ss, eio, eo, back, mulberry } from '/core/lib.js';

export const DUR = 60;
const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
const pr = (t, a, b) => clamp((t - a) / (b - a));

// ── crayon box (11) + one watercolour ────────────────────────────────────────
const K = {
  ink: '#2d3263', leaf: '#5fae4a', olive: '#8a8f3a', sand: '#e9c27a', lemon: '#f6d43c', orange: '#ee8a3a',
  sky: '#7fb6df', pink: '#ef8fa6', reed: '#3f8a52', brown: '#7a4b31', white: '#fbfaf4',
};
const WASH_T = [0.2, 0.25, 0.54];   // ultramarine (transmitted colour)

// ── narration (t = speech start, d from voices/dur.json) ─────────────────────
const DURS = { n01: 1.112, n02: 1.556, n03: 1.409, n04: 1.055, n05: 1.567, n06: 1.512, n07: 2.461, n08: 2.127, n09: 1.558, n10: 2.645, n11: 1.664, n12: 1.977, n13: 1.728 };
export const LINES = [
  ['n01', 1.6, 'This is Tuck.'], ['n02', 3.3, 'Tuck is a little turtle.'], ['n03', 6.6, 'Tuck loves sunny days.'],
  ['n04', 11.6, 'Bye-bye, Sun!'], ['n05', 13.9, 'The sun is going to bed.'], ['n06', 19.6, 'Here comes the dark.'],
  ['n07', 22.2, 'Tuck is scared. He hides in his shell.'], ['n08', 28.5, 'Inside, it is very dark.'], ['n09', 31.6, 'Tap, tap! Who is that?'],
  ['n10', 34.6, 'It is Firefly. "Come with me," she says.'], ['n11', 39.9, 'Tuck takes one little step.'],
  ['n12', 50.4, 'The dark is full of little lights!'], ['n13', 55.2, 'Goodnight, little turtle.'],
].map(([id, t, txt]) => ({ id, t, d: DURS[id], text: txt }));
export const SUBS = LINES.map((L, i) => { const t0 = L.t - 0.1; let t1 = Math.max(t0 + 1.8, L.t + L.d + 0.7); const nx = LINES[i + 1]; if (nx) t1 = Math.min(t1, nx.t - 0.25); return { t0, t1, text: L.text }; });

// ── the page (world coords) ──────────────────────────────────────────────────
const GY = 1180;                         // shore line, Tuck's feet
const X0 = -600, X1 = 5200;
const SUN0 = [2350, 430];
const HILL = smooth([[1650, GY + 10], [1900, 900], [2300, 760], [2750, 840], [3050, 960], [3250, GY + 10]], 10, false);
const LIGHTS = [
  { kind: 'flower', x: 2300, y: GY - 6, t: 45.2 },
  { kind: 'mush', x: 2660, y: GY - 4, t: 46.6 },
  { kind: 'frog', x: 3020, y: GY + 70, t: 48.0 },
  { kind: 'lily', x: 3330, y: GY + 120, t: 49.3 },
  { kind: 'lily', x: 3560, y: GY + 170, t: 49.9 },
];
const FLIES = Array.from({ length: 26 }, (_, i) => { const r = mulberry(500 + i); return { x: 2200 + r() * 1700, y: 650 + r() * 520, t: 50.2 + r() * 2.6, ph: r() * 6.28 }; });

// ── Tuck: side view facing right; feet at (x, y) ─────────────────────────────
// o: s (scale), dir, walk (step index), hide (0–1), peek (0–1, eyes in the gap), look (head tilt: + up), wave (0–1), sleep (0–1), worry, smile
export function tuck(C, o) {
  const s = o.s ?? 1, d = o.dir ?? 1, X = (x) => o.x + x * s * d, Y = (y) => o.y + y * s;
  const P = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
  const sd = 7000, hide = o.hide ?? 0, sleep = o.sleep ?? 0;
  const lift = (o.walk != null && o.walk % 2) ? 3 : 0;
  const lw = 7;
  // far legs (behind the shell)
  const legOut = 1 - hide;
  const leg = (bx, step, sdd, far) => {
    if (legOut <= 0.02) return;
    const kx = step ? 16 : -8, ky = step ? -12 : 0;
    const top = [bx, -74], foot = [bx + kx * legOut, -74 + (66 + ky) * legOut];
    part(C, P(tube([top, foot], 50 * legOut + 4, 46 * legOut + 4)), { col: K.leaf, p: far ? 0.72 : 0.88, gap: 7, w: 9, seed: sdd }, { w: lw, seed: sdd + 1 });
    if (legOut > 0.5) part(C, P(handCircle(foot[0] + 10, foot[1] + 2, 26, sdd + 5, 0, 16).map(([a, b]) => [a, foot[1] + 2 + (b - foot[1] - 2) * 0.45])), { col: K.leaf, p: 0.9, gap: 6, w: 8, seed: sdd + 6 }, { w: lw, seed: sdd + 7 });
  };
  const wk = o.walk ?? 0;
  leg(-58, wk % 2 === 1, sd + 10, true); leg(84, wk % 2 === 0 && (o.wave ?? 0) < 0.5, sd + 12, true);
  // tail
  if (legOut > 0.1) part(C, P([[-118, -84], [-156, -70 + 6 * Math.sin(wk)], [-116, -62]]), { col: K.leaf, p: 0.85, gap: 6, w: 8, seed: sd + 20 }, { w: lw, seed: sd + 21 });
  // head + neck (head retracts into the shell when hiding)
  const look = o.look ?? 0;
  const hx = lerp(158, 96, hide) - 26 * sleep, hy = lerp(-128, -96, hide) + 66 * sleep - 40 * look - lift;
  if (hide < 0.97) {
    const neck = P(tube([[76, -96], [hx - 26, hy + 18]], 48, 42));
    part(C, neck, { col: K.leaf, p: 0.85, gap: 7, w: 9, seed: sd + 30 }, { w: lw, seed: sd + 31 });
    const hr = 58;
    const head = P(handCircle(hx, hy, hr, sd + 33, 0, 40).map(([x, y]) => [x, hy + (y - hy) * 0.92]));
    part(C, head, { col: K.leaf, p: 0.9, gap: 7, w: 9, seed: sd + 32 }, { w: lw, seed: sd + 34 });
    // face
    const ex = hx + 20, ey = hy - 10 - 4 * look;
    if (sleep > 0.5) line(C.l, P([[ex - 12, ey + 2], [ex, ey + 8], [ex + 12, ey + 2]]), { w: 5, seed: sd + 40 });
    else {
      dab(C.f, X(ex), Y(ey), 8 * s, { col: K.ink, p: 1, seed: sd + 41, gap: 3, w: 5 });
      dab(C.f, X(ex + 3), Y(ey - 3), 2.6 * s, { col: K.white, p: 1, seed: sd + 42, gap: 2, w: 3 });
    }
    if (o.worry) line(C.l, P([[ex - 14, ey - 22], [ex + 10, ey - 16]]), { w: 4.5, seed: sd + 43 });
    dab(C.f, X(hx + 30), Y(hy + 16), 9 * s, { col: K.pink, p: 0.75, seed: sd + 44 });
    const sm = o.smile ?? 1;
    line(C.l, P(sm > 0 ? [[hx + 22, hy + 22], [hx + 34, hy + 28], [hx + 46, hy + 20]] : [[hx + 24, hy + 28], [hx + 34, hy + 24], [hx + 46, hy + 28]]), { w: 4.5, seed: sd + 45 });
  }
  // shell (dome) with sand patches
  const dome = P([...ellipse(0, -92, 130, 108, 28, Math.PI, Math.PI * 2), [130, -78], [-130, -78]]);
  part(C, dome, { col: K.olive, p: 0.95, gap: 8, w: 10, seed: sd + 50, cross: true }, { w: 8, seed: sd + 51 });
  [[-62, -142, 30], [10, -160, 32], [76, -132, 28], [-26, -108, 26], [46, -102, 24]].forEach(([cx, cy, r], i) =>
    part(C, P(handCircle(cx, cy, r, sd + 60 + i, 0, 6)), { col: K.sand, p: 0.9, gap: 6, w: 8, seed: sd + 62 + i * 3 }, { w: 5, seed: sd + 63 + i * 3 }));
  // rim
  part(C, P([[-136, -86], [136, -86], [128, -64], [-128, -64]]), { col: K.sand, p: 0.95, gap: 6, w: 8, seed: sd + 80 }, { w: 7, seed: sd + 81 });
  // near legs
  leg(-74, wk % 2 === 0, sd + 14, false);
  if ((o.wave ?? 0) > 0.05 && hide < 0.5) {    // front leg waving
    const a = -0.5 - 1.6 * (o.wave ?? 0) + 0.35 * Math.sin((o.waveT ?? 0) * 12);
    const top = [112, -82], tip = [112 + Math.cos(a) * 70, -82 + Math.sin(a) * 70];
    part(C, P(tube([top, tip], 38, 32)), { col: K.leaf, p: 0.9, gap: 7, w: 9, seed: sd + 16 }, { w: lw, seed: sd + 17 });
  } else leg(70, wk % 2 === 1, sd + 16, false);
  // peeking eyes in the dark gap of the shell
  if ((o.peek ?? 0) > 0.05) {
    part(C, P(handCircle(104, -100, 30, sd + 89, 0, 18).map(([a, b]) => [a, -100 + (b + 100) * 0.6])), { col: K.ink, p: 1, gap: 4, w: 7, seed: sd + 90 }, { w: 5, seed: sd + 93 });
    dab(C.f, X(94), Y(-100), 7 * s, { col: K.white, p: o.peek, seed: sd + 91, gap: 2, w: 4 });
    dab(C.f, X(116), Y(-100), 7 * s, { col: K.white, p: o.peek, seed: sd + 92, gap: 2, w: 4 });
    dab(C.f, X(96), Y(-99), 3 * s, { col: K.ink, p: o.peek, seed: sd + 94, gap: 2, w: 3 });
    dab(C.f, X(118), Y(-99), 3 * s, { col: K.ink, p: o.peek, seed: sd + 95, gap: 2, w: 3 });
  }
}

// ── Firefly ──────────────────────────────────────────────────────────────────
export function firefly(C, L, x, y, s, t, o = {}) {
  const sd = 7400 + (o.seed ?? 0), flap = Math.floor(t * 12) % 2;
  const glow = o.glow ?? 1;
  // glow: white wax halo then a lemon core (drawn after the wash: it shines on the night)
  if (glow > 0) {
    fill(L, handCircle(x - 30 * s, y + 10 * s, 34 * s * glow, sd, 0, 20), { col: K.white, p: 0.6 * glow, gap: 5, w: 8, seed: sd + 1, over: 4 });
    fill(L, handCircle(x - 30 * s, y + 10 * s, 18 * s, sd + 2, 0, 16), { col: K.lemon, p: 1, gap: 4, w: 7, seed: sd + 3 });
  }
  const P = (pts) => pts.map(([px, py]) => [x + px * s, y + py * s]);
  [[-6, -18], [10, -20]].forEach(([wx, wy], i) => {
    const r = flap ? 0.5 : -0.2;
    part(C, P(xf(handCircle(0, 0, 18, sd + 10 + i, 0, 16).map(([a, b]) => [a, b * 0.55]), { x: wx, y: wy, r: r - i * 0.3 })), { col: K.sky, p: 0.5, gap: 5, w: 6, seed: sd + 12 + i }, { w: 4, seed: sd + 14 + i });
  });
  part(C, P(handCircle(0, 0, 22, sd + 20, 0, 18).map(([a, b]) => [a * 1.25, b * 0.85])), { col: K.lemon, p: 0.9, gap: 5, w: 7, seed: sd + 21 }, { w: 5, seed: sd + 22 });
  part(C, P(handCircle(22, -8, 14, sd + 23, 0, 14)), { col: K.brown, p: 0.8, gap: 4, w: 6, seed: sd + 24 }, { w: 5, seed: sd + 25 });
  dab(C.f, x + 27 * s, y - 11 * s, 3.5 * s, { col: K.white, p: 1, seed: sd + 26, gap: 2, w: 3 });
  line(C.l, P([[22, -20], [26, -36], [32, -40]]), { w: 3.5, seed: sd + 27 });
}

// ── the sun (child logic: a face, an arm-ray that waves, a yawn) ──────────────
function sun(C, x, y, t, o = {}) {
  const sd = 7600, r = 104;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.1, wave = (i === 1 && o.wave) ? Math.sin(t * 10) * 0.25 * o.wave : 0;
    line(C.l, [[x + Math.cos(a + wave) * (r + 22), y + Math.sin(a + wave) * (r + 22)], [x + Math.cos(a + wave) * (r + 70), y + Math.sin(a + wave) * (r + 70)]], { w: 9, col: K.orange, seed: sd + i, p: 0.9 });
  }
  part(C, handCircle(x, y, r, sd + 20, 0.05, 48), { col: K.lemon, p: 0.95, gap: 9, w: 11, seed: sd + 21, cross: true }, { w: 8, col: K.orange, seed: sd + 22 });
  const yawn = o.yawn ?? 0;
  if (yawn > 0.3) { line(C.l, [[x - 46, y - 18], [x - 30, y - 12], [x - 14, y - 18]], { w: 6, seed: sd + 30 }); line(C.l, [[x + 14, y - 18], [x + 30, y - 12], [x + 46, y - 18]], { w: 6, seed: sd + 31 });
    part(C, handCircle(x, y + 34, 18 * yawn, sd + 32, 0, 18), { col: K.orange, p: 0.9, gap: 4, w: 6, seed: sd + 33 }, { w: 5, seed: sd + 34 }); }
  else { dab(C.f, x - 32, y - 16, 9, { col: K.ink, p: 1, seed: sd + 35 }); dab(C.f, x + 32, y - 16, 9, { col: K.ink, p: 1, seed: sd + 36 });
    line(C.l, [[x - 36, y + 26], [x, y + 46], [x + 36, y + 26]], { w: 6, seed: sd + 37 }); }
  dab(C.f, x - 60, y + 18, 13, { col: K.pink, p: 0.7, seed: sd + 38 }); dab(C.f, x + 60, y + 18, 13, { col: K.pink, p: 0.7, seed: sd + 39 });
}

// ── night lights (drawn live when Firefly touches them) ──────────────────────
function glowAt(L, x, y, r, k, seed) { fill(L, handCircle(x, y, r * k * 1.15, seed, 0, 24), { col: K.lemon, p: 0.28 * k, gap: 9, w: 10, seed: seed + 1, over: 6 }); fill(L, handCircle(x, y, r * k * 0.7, seed + 2, 0, 20), { col: K.white, p: 0.42 * k, gap: 7, w: 9, seed: seed + 3, over: 4 }); }
function nightLight(L, it, t) {
  const k = eo(pr(t, it.t, it.t + 0.55)); if (k <= 0) return;
  const tw = 0.9 + 0.1 * Math.sin(t * 5 + it.x);
  if (it.kind === 'flower') {
    glowAt(L, it.x, it.y - 90, 62 * tw, k, 9100);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; fill(L, handCircle(it.x + Math.cos(a) * 26, it.y - 90 + Math.sin(a) * 26, 17, 9110 + i, 0, 14), { col: K.pink, p: 0.95, gap: 4, w: 6, seed: 9120 + i, draw: pr(k, i / 7, i / 7 + 0.3) }); }
    fill(L, handCircle(it.x, it.y - 90, 16, 9130, 0, 14), { col: K.lemon, p: 1, gap: 4, w: 6, seed: 9131, draw: k });
  } else if (it.kind === 'mush') {
    glowAt(L, it.x, it.y - 60, 80 * tw, k, 9200);
    fill(L, [...ellipse(it.x, it.y - 64, 66, 52, 20, Math.PI, Math.PI * 2)], { col: K.orange, p: 1, gap: 6, w: 8, seed: 9201, draw: k });
    [[-30, -84], [8, -96], [34, -76]].forEach(([dx, dy], i) => fill(L, handCircle(it.x + dx, it.y + dy, 9, 9210 + i, 0, 12), { col: K.lemon, p: 1, gap: 3, w: 5, seed: 9215 + i, draw: pr(k, 0.5, 1) }));
  } else if (it.kind === 'frog') {
    glowAt(L, it.x - 20, it.y - 70, 46 * tw, k, 9300); glowAt(L, it.x + 24, it.y - 70, 46 * tw, k, 9305);
    fill(L, handCircle(it.x - 20, it.y - 70, 15, 9310, 0, 14), { col: K.lemon, p: 1, gap: 3, w: 6, seed: 9311, draw: k });
    fill(L, handCircle(it.x + 24, it.y - 70, 15, 9312, 0, 14), { col: K.lemon, p: 1, gap: 3, w: 6, seed: 9313, draw: k });
  } else if (it.kind === 'lily') {
    glowAt(L, it.x, it.y - 40, 70 * tw, k, 9400 + it.x);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; line(L, [[it.x, it.y - 20], [it.x + Math.cos(a) * 44, it.y - 20 + Math.sin(a) * 44]], { w: 16, col: i % 2 ? K.pink : K.white, p: 0.95, seed: 9410 + i + it.x, draw: pr(k, i / 6, i / 6 + 0.4) }); }
    fill(L, handCircle(it.x, it.y - 24, 13, 9420 + it.x, 0, 12), { col: K.lemon, p: 1, gap: 3, w: 5, seed: 9421 + it.x, draw: k });
  }
}

// ── the world (day drawing; stays still) ─────────────────────────────────────
function drawWorld(BGf, BGl, t, drawK) {
  const dk = drawK;   // opening draw-on progress for the background (0–1)
  // pond water
  const water = [[1250, GY + 40], [1500, GY + 20], [2600, GY + 30], [3900, GY + 20], [4700, GY + 30], [4700, 2600], [1250, 2600]];
  fill(BGf, water, { col: K.sky, p: 0.62, gap: 11, w: 12, seed: 8001, ang: 0.08, draw: pr(dk, 0.2, 0.7), boil: 0 });
  line(BGl, smooth([[1250, GY + 40], [1500, GY + 20], [2600, GY + 30], [3900, GY + 20], [4700, GY + 30]], 8, false), { w: 6, seed: 8002, draw: pr(dk, 0.1, 0.5), boil: 0.6 });
  for (let i = 0; i < 9; i++) { const wx = 1500 + i * 360, wy = GY + 120 + (i % 3) * 110; line(BGl, [[wx, wy], [wx + 40, wy - 12], [wx + 80, wy]], { w: 4, col: K.ink, p: 0.6, seed: 8010 + i, draw: pr(dk, 0.5, 0.9), boil: 0.6 }); }
  // grass shore
  fill(BGf, [[X0, GY - 6], [1300, GY - 4], [1260, 2600], [X0, 2600]], { col: K.leaf, p: 0.7, gap: 11, w: 12, seed: 8020, draw: pr(dk, 0.2, 0.8), boil: 0 });
  fill(BGf, [[1300, GY - 6], [4700, GY - 6], [4700, GY + 26], [1300, GY + 30]], { col: K.leaf, p: 0.75, gap: 8, w: 10, seed: 8021, ang: 0.05, draw: pr(dk, 0.3, 0.9), boil: 0 });
  line(BGl, [[X0, GY - 4], [X1, GY - 4]], { w: 6, seed: 8022, draw: pr(dk, 0, 0.4), boil: 0.6 });
  for (let i = 0; i < 60; i++) { const gx = X0 + 40 + i * 95 + 30 * hash(i); line(BGl, [[gx, GY - 2], [gx + 8, GY - 30 - 14 * hash(i + 3)]], { w: 4.5, col: K.reed, seed: 8030 + i, draw: pr(dk, 0.4, 0.9), boil: 0.6 }); }
  // the hill
  fill(BGf, [...HILL], { col: K.reed, p: 0.55, gap: 12, w: 13, seed: 8040, draw: pr(dk, 0.3, 0.9), boil: 0 });
  line(BGl, HILL, { w: 7, seed: 8041, draw: pr(dk, 0.1, 0.6), boil: 0.6 });
  // reeds
  [[1380, 1], [1460, 0], [3820, 1], [3900, 0], [3980, 1]].forEach(([rx, k], i) => {
    line(BGl, [[rx, GY + 30], [rx + 10, GY - 190 - 30 * k]], { w: 6, col: K.reed, seed: 8050 + i, draw: pr(dk, 0.4, 0.9), boil: 0.6 });
    fill(BGf, ellipse(rx + 10, GY - 200 - 30 * k, 12, 34, 14), { col: K.brown, p: 0.85, gap: 5, w: 7, seed: 8060 + i, draw: pr(dk, 0.6, 1), boil: 0 });
  });
  [[900, 360, 1], [3100, 300, 0.8]].forEach(([cx, cy, k], i) => { const cl = smooth([[cx - 120 * k, cy + 30], [cx - 90 * k, cy - 30], [cx - 20 * k, cy - 60], [cx + 60 * k, cy - 40], [cx + 120 * k, cy + 10], [cx + 60 * k, cy + 40], [cx - 40 * k, cy + 44]], 8);
    line(BGl, cl, { w: 6, col: K.sky, seed: 8170 + i, boil: 0.6, draw: pr(dk, 0.5, 1) }); });
  // a little tree on the left
  fill(BGf, handCircle(420, 820, 170, 8070, 0, 30), { col: K.leaf, p: 0.75, gap: 10, w: 12, seed: 8071, draw: pr(dk, 0.3, 0.9), boil: 0 });
  line(BGl, handCircle(420, 820, 170, 8072, 0.08, 40), { w: 7, seed: 8073, draw: pr(dk, 0.1, 0.6), boil: 0.6 });
  fill(BGf, [[400, 980], [440, 980], [450, GY], [390, GY]], { col: K.brown, p: 0.9, gap: 6, w: 8, seed: 8074, draw: pr(dk, 0.3, 0.8), boil: 0 });
  // the day objects that will light up at night
  const F = LIGHTS[0];
  line(BGl, [[F.x, F.y], [F.x + 4, F.y - 76]], { w: 5, col: K.reed, seed: 8100, boil: 0.6, draw: pr(dk, 0.5, 1) });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; fill(BGf, handCircle(F.x + Math.cos(a) * 26, F.y - 90 + Math.sin(a) * 26, 17, 8110 + i, 0, 14), { col: K.pink, p: 0.7, gap: 5, w: 6, seed: 8120 + i, boil: 0, draw: pr(dk, 0.6, 1) }); }
  const M = LIGHTS[1];
  fill(BGf, [[M.x - 18, M.y], [M.x + 18, M.y], [M.x + 14, M.y - 60], [M.x - 14, M.y - 60]], { col: K.sand, p: 0.8, gap: 5, w: 7, seed: 8130, boil: 0, draw: pr(dk, 0.6, 1) });
  fill(BGf, ellipse(M.x, M.y - 64, 66, 52, 20, Math.PI, Math.PI * 2), { col: K.orange, p: 0.6, gap: 7, w: 8, seed: 8131, boil: 0, draw: pr(dk, 0.6, 1) });
  line(BGl, [...ellipse(M.x, M.y - 64, 66, 52, 20, Math.PI, Math.PI * 2), [M.x - 66, M.y - 64]], { w: 6, seed: 8132, boil: 0.6, draw: pr(dk, 0.6, 1) });
  // frog on a lily pad
  const Fr = LIGHTS[2];
  fill(BGf, ellipse(Fr.x, Fr.y, 110, 34, 24), { col: K.reed, p: 0.8, gap: 7, w: 9, seed: 8140, boil: 0, draw: pr(dk, 0.6, 1) });
  fill(BGf, ellipse(Fr.x, Fr.y - 40, 56, 38, 20), { col: K.leaf, p: 0.85, gap: 6, w: 8, seed: 8141, boil: 0, draw: pr(dk, 0.6, 1) });
  line(BGl, ellipse(Fr.x, Fr.y - 40, 56, 38, 20), { w: 6, seed: 8142, boil: 0.6, closed: true, draw: pr(dk, 0.6, 1) });
  [[-20, -70], [24, -70]].forEach(([dx, dy], i) => { line(BGl, handCircle(Fr.x + dx, Fr.y + dy, 16, 8143 + i, 0, 14), { w: 5, seed: 8145 + i, boil: 0.6, draw: pr(dk, 0.7, 1) }); dab(BGf, Fr.x + dx + 3, Fr.y + dy, 6, { col: K.ink, p: 1, seed: 8147 + i, boil: 0 }); });
  line(BGl, [[Fr.x - 20, Fr.y - 30], [Fr.x + 2, Fr.y - 22], [Fr.x + 24, Fr.y - 30]], { w: 4, seed: 8149, boil: 0.6, draw: pr(dk, 0.7, 1) });
  // lily pads
  LIGHTS.slice(3).forEach((Lp, i) => { fill(BGf, ellipse(Lp.x, Lp.y, 96, 30, 24), { col: K.reed, p: 0.8, gap: 7, w: 9, seed: 8150 + i, boil: 0, draw: pr(dk, 0.6, 1) }); line(BGl, ellipse(Lp.x, Lp.y, 96, 30, 24), { w: 5, seed: 8155 + i, boil: 0.6, closed: true, draw: pr(dk, 0.6, 1) }); });
  // a stone where Tuck sleeps at the end
  fill(BGf, ellipse(3700, GY + 6, 80, 24, 20), { col: K.sand, p: 0.6, gap: 6, w: 8, seed: 8160, boil: 0, draw: pr(dk, 0.6, 1) });
}

// ── timeline ─────────────────────────────────────────────────────────────────
// Tuck's position and pose over time
const WALK1 = [5.3, 10.6], WALK2 = [41.4, 53.6];
function tuckState(t) {
  let x = 1100, walk = null;
  if (t >= WALK1[0]) { const u = pr(t, WALK1[0], WALK1[1]); x = lerp(1100, 1560, u); if (t < WALK1[1]) walk = Math.floor(t * 4); }
  if (t >= WALK2[0]) { const u = pr(t, WALK2[0], WALK2[1]); x = lerp(1560, 3560, ss(u) * 0.15 + u * 0.85); if (t < WALK2[1]) walk = Math.floor(t * 4); }
  const o = { x, y: GY, s: 1, walk, smile: 1, sd: 1 };
  if (t > 11.2 && t < 13.6) { o.wave = eo(pr(t, 11.2, 11.6)) * (1 - pr(t, 13.2, 13.6)); o.waveT = t; o.look = 0.5; }
  if (t > 13.6 && t < 17) o.look = 0.4 * (1 - pr(t, 16, 17));
  if (t > 19.2 && t < 23) { o.worry = 1; o.smile = -1; o.look = 0.15 * Math.sin(t * 3); }
  o.hide = ss(pr(t, 22.6, 23.4)) * (1 - ss(pr(t, 38.6, 39.6)));
  if (t > 25.5 && t < 39.4) o.peek = pr(t, 25.5, 26.3) * (1 - pr(t, 38.8, 39.3));
  if (t > 39.2 && t < 41.4) { o.worry = 1; o.smile = 0; o.look = 0.2; }
  if (t > 44) o.look = 0.25 + 0.1 * Math.sin(t * 1.3);
  if (t > 53.6) { o.look = 0; o.sleep = ss(pr(t, 55.6, 57.2)); }
  return o;
}
// Firefly: flies in, lands by the shell, leads the walk touching each light, rests on the shell
function fireflyPos(t) {
  if (t < 31.4) return null;
  if (t < 33.2) { const u = eo(pr(t, 31.4, 33.2)); return [lerp(2080, 1800, u), lerp(760, 990, u) + 20 * Math.sin(t * 6)]; }
  if (t < 41.4) return [1800 + 6 * Math.sin(t * 3), 990 + 10 * Math.sin(t * 4.3)];
  const pts = [[41.4, 1800, 990], [43.5, 1950, 990], ...LIGHTS.map(L => [L.t, L.x - 30, L.y - (L.kind === 'lily' ? 80 : L.kind === 'frog' ? 120 : 140)]), [52.0, 3460, 960], [54.6, 3610, 1020], [56.4, 3560, 1010]];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (t <= b[0]) { const u = ss(pr(t, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u) - 50 * Math.sin(u * Math.PI)]; } }
  const tx = tuckState(t).x; return [tx - 10, GY - 170];
}
// camera: [x, y, zoom] (page scale 0.6 = a wide view)
const camT = track([
  [0, [1210, 1050, 2.6]], [0.6, [1210, 1050, 2.6]], [4.4, [1350, 900, 0.72]], [5.3, [1350, 900, 0.72]],
  [10.8, [1700, 900, 0.78]], [11.6, [1900, 780, 0.72]], [13.2, [1990, 740, 0.72]], [16.2, [1990, 760, 0.72]], [17.2, [1800, 880, 0.7]],
  [23.8, [1800, 880, 0.7]], [25.0, [1580, 1090, 1.2]], [31.0, [1600, 1100, 1.75]], [31.8, [1640, 1060, 1.5]], [38.0, [1660, 1060, 1.5]],
  [40.0, [1660, 1030, 1.2]], [41.6, [1700, 1030, 1.15]], [44.0, [2050, 1010, 1.0]], [46.0, [2420, 1000, 1.0]], [48.0, [2820, 1030, 1.0]],
  [50.2, [3150, 980, 0.92]], [53.6, [3500, 960, 0.85]], [55.0, [3560, 1060, 1.15]], [60, [3560, 1090, 1.8]],
]);
const camV = track([
  [0, [1180, 1080, 2.6]], [0.6, [1180, 1080, 2.6]], [4.4, [1230, 950, 1.0]], [5.3, [1230, 950, 1.05]],
  [10.8, [1600, 950, 1.1]], [11.6, [1830, 820, 0.9]], [13.2, [1880, 800, 0.9]], [16.2, [1900, 820, 0.9]], [17.2, [1700, 900, 0.75]],
  [23.8, [1700, 900, 0.75]], [25.0, [1600, 1080, 1.5]], [31.0, [1620, 1090, 2.2]], [31.8, [1660, 1040, 1.6]], [38.0, [1670, 1040, 1.6]],
  [40.0, [1700, 1030, 1.35]], [41.6, [1720, 1030, 1.25]], [44.0, [2200, 1000, 1.0]], [46.0, [2550, 1000, 1.0]], [48.0, [2900, 1020, 1.0]],
  [50.2, [3250, 980, 0.95]], [53.6, [3560, 960, 0.9]], [55.0, [3560, 1060, 1.25]], [60, [3560, 1090, 1.9]],
]);
const VERT = H > W;
// the dark: one wash band sweeping left → right across the whole page
const WASH = { t0: 17.4, t1: 23.2 };
function drawWash(LW, t) {
  if (t < WASH.t0) return;
  const g = LW.g; g.save();
  g.setTransform(CAM.s, 0, 0, CAM.s, W / 2 - CAM.x * CAM.s, H / 2 - CAM.y * CAM.s);
  const front = t < WASH.t1 - 0.4 ? lerp(300, 3400, ss(pr(t, WASH.t0, WASH.t1 - 0.4)) * 0.3 + pr(t, WASH.t0, WASH.t1 - 0.4) * 0.7) : X1 + 900;   // slow inside the frame, then the rest of the page off screen
  const frontX = y => front + 120 * Math.sin(y * 0.003) + 40 * Math.sin(y * 0.02);
  g.beginPath(); g.moveTo(X0 - 600, -800); for (let y = -800; y <= 2400; y += 30) g.lineTo(frontX(y), y); g.lineTo(X0 - 600, 2400); g.closePath(); g.clip();
  g.fillStyle = '#000'; g.globalAlpha = 0.78; g.fillRect(X0 - 600, -800, X1 - X0 + 1400, 3200);
  const R = mulberry(77);
  for (let i = 0; i < 34; i++) {
    const yy = lerp(-600, 2200, R()), wdt = 10 + R() * 40, dark = R() < 0.55;
    g.beginPath(); for (let x = X0 - 600; x <= X1 + 600; x += 80) { const y = yy + 18 * Math.sin(x * 0.002 + i) + 8 * Math.sin(x * 0.01 + i * 2); x === X0 - 600 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.lineWidth = dark ? wdt : wdt * 0.5; g.globalCompositeOperation = dark ? 'source-over' : 'destination-out'; g.globalAlpha = dark ? 0.12 + R() * 0.1 : 0.04 + R() * 0.06; g.strokeStyle = '#000'; g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  if (t < WASH.t1) { g.beginPath(); for (let y = -800; y <= 2400; y += 20) { const x = frontX(y) - 18; y === -800 ? g.moveTo(x, y) : g.lineTo(x, y); } g.lineWidth = 40; g.globalAlpha = 0.25; g.stroke(); }
  g.restore();
}

// ── events (sound) ───────────────────────────────────────────────────────────
export const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
LINES.forEach(L => ev(L.t, 'voice', { id: L.id }));
ev(0, 'room'); ev(0.0, 'scratch', { dur: 1.2, pan: -0.2 }); ev(1.4, 'scratch', { dur: 1.4, pan: 0.2 }); ev(2.8, 'scribble', { dur: 1.6, pan: 0 });
for (let k = Math.ceil(WALK1[0] * 4); k < WALK1[1] * 4; k++) ev(k / 4, 'step', { pan: -0.3 });
ev(8.4, 'splash'); ev(11.3, 'wave'); ev(14.6, 'yawn'); ev(15.2, 'slide', { dur: 1.6 });
ev(16.5, 'crickets', { dur: 43 });
ev(WASH.t0, 'brush', { dur: WASH.t1 - WASH.t0 });
ev(22.7, 'hide'); ev(26.5, 'breath');
ev(31.4, 'tap'); ev(31.75, 'tap'); ev(32.0, 'flutter', { dur: 1.3 }); ev(33.3, 'glow');
ev(39.0, 'peek'); for (let k = Math.ceil(WALK2[0] * 4); k < WALK2[1] * 4; k++) ev(k / 4, 'step', { pan: 0.1 });
LIGHTS.forEach((L, i) => { ev(L.t, 'light', { i }); ev(L.t, 'swish', { dur: 0.5 }); });
FLIES.forEach((f, i) => { if (i % 3 === 0) ev(f.t, 'sparkle', { i }); });
ev(48.1, 'croak'); ev(55.0, 'curl');
[['A', 0], ['B', 17.1], ['C', 28.6], ['D', 31.4], ['E', 42.9], ['F', 54.3]].forEach(([id, t]) => ev(t, 'cue', { id }));

// ── layers ───────────────────────────────────────────────────────────────────
const BG = { f: layer(), l: layer() }, SUNG = group(), TK = group(), FF = group(), FX = layer(), WL = layer(), SUBK = layer(), SUBT = layer();
export function frame(comp, t) {
  [CAM.x, CAM.y, CAM.s] = VERT ? camV(t) : camT(t);
  BOIL.amp = (t > 24 && t < 31) || t > 56 ? 0.5 : 1;
  [BG.f, BG.l, FX, WL, SUBK, SUBT].forEach(clear); clearGroup(SUNG); clearGroup(TK); clearGroup(FF);
  // opening: the page draws itself around Tuck
  drawWorld(BG.f, BG.l, t, pr(t, 0.8, 4.4));
  // sun: waves, yawns, slides behind the hill
  const sdown = ss(pr(t, 15.0, 16.8));
  const sp = [SUN0[0] + 60 * sdown, SUN0[1] + 640 * sdown];
  if (t > 2.4 && sdown < 1) {
    sun(SUNG, sp[0], sp[1], t, { wave: t > 11.4 && t < 13.6 ? 1 : 0, yawn: t > 14.2 && t < 16.8 ? pr(t, 14.2, 14.7) : 0 });
    const hillMask = [...HILL, [3250, GY + 400], [1650, GY + 400]];          // the hill hides the setting sun
    erase(SUNG.f, hillMask); erase(SUNG.l, hillMask); erase(SUNG.k, hillMask);
  }
  // Tuck (drawn on from the crayon tip in the opening)
  const ts = tuckState(t);
  tuck(TK, ts);
  if (t < 1.6) {   // opening: erase what is not yet drawn (revealed in a sweep from the crayon tip)
    const g = TK.l.g, f = TK.f.g, k = pr(t, 0, 1.4);
    for (const gg of [g, f]) { gg.save(); gg.globalCompositeOperation = 'destination-out'; gg.fillStyle = '#000'; gg.fillRect(sx(1110 - 160 + 330 * k), 0, W, H); gg.restore(); }
  }
  // Firefly
  const fp = fireflyPos(t);
  if (fp) { const glow = t > 33.0 ? 1 : pr(t, 32.2, 33.0); firefly(FF, FX, fp[0], fp[1], 1.1, t, { glow }); }
  // night lights
  LIGHTS.forEach(L => nightLight(FX, L, t));
  FLIES.forEach((f, i) => { const k = eo(pr(t, f.t, f.t + 0.4)); if (k <= 0) return; const x = f.x + 30 * Math.sin(t * 0.8 + f.ph), y = f.y + 20 * Math.sin(t * 1.1 + f.ph);
    const tw = 0.7 + 0.3 * Math.sin(t * 4 + f.ph); fill(FX, handCircle(x, y, 22 * k * tw, 9600 + i, 0, 14), { col: K.white, p: 0.55, gap: 5, w: 7, seed: 9620 + i }); fill(FX, handCircle(x, y, 9 * k, 9650 + i, 0, 10), { col: K.lemon, p: 1, gap: 3, w: 5, seed: 9680 + i }); });
  // the crayon tip in the opening
  if (t < 1.5) { const k = pr(t, 0, 1.4), cx = 1110 - 160 + 330 * k, cy = GY - 70 - 60 * Math.sin(k * 6);
    const tip = [[cx, cy], [cx + 26, cy - 60], [cx + 120, cy - 260], [cx + 170, cy - 236], [cx + 74, cy - 40]];
    part(FF, tip, { col: K.leaf, p: 1, gap: 6, w: 9, seed: 9900 }, { w: 6, seed: 9901 }); }
  drawWash(WL, t);
  subTo(SUBK, SUBT, t);
  comp.paperCam(CAM.x * 0.6, CAM.y * 0.6, CAM.s / 0.6);
  comp.begin();
  comp.crayon(BG.f.c); comp.crayon(BG.l.c);
  const go = [hash(BOIL.step) * 300, hash(BOIL.step + 7) * 300];
  comp.group(SUNG, { goff: go });
  if (t > WASH.t0) comp.wash(WL.c, { color: WASH_T, gran: 0.25, edge: 1.2 });
  comp.group(TK, { goff: go });          // characters after the wash: readable at night
  comp.crayon(FX.c, { goff: go });
  comp.group(FF, { goff: go });
  comp.knock(SUBK.c); comp.crayon(SUBT.c);
  comp.finish({ vig: 0.3 });
}
export function subTo(SUBK, SUBT, t) {
  const S = SUBS.find(s => t >= s.t0 && t < s.t1); if (!S) return;
  const rv = pr(t, S.t0, S.t0 + 0.35);
  const g = SUBK.g; g.save(); g.font = '400 56px "Patrick Hand"';
  let rows = [S.text]; if (g.measureText(S.text).width > W - 160) { const w = S.text.split(' '); let best = 1, bd = 1e9; for (let k = 1; k < w.length; k++) { const d = Math.abs(g.measureText(w.slice(0, k).join(' ')).width - g.measureText(w.slice(k).join(' ')).width); if (d < bd) { bd = d; best = k; } } rows = [w.slice(0, best).join(' '), w.slice(best).join(' ')]; }
  const tw = Math.max(...rows.map(r => g.measureText(r).width)); g.restore();
  const cx = W / 2, cy = VERT ? H * 0.74 : H - 80, hw = tw / 2 + 50, hh = 46 + (rows.length - 1) * 32;
  g.save(); g.fillStyle = '#000'; g.beginPath();
  for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; const px = Math.cos(a), py = Math.sin(a); const sq = Math.pow(Math.abs(px), 0.3) * Math.sign(px); const n = 1 + 0.06 * Math.sin(a * 7 + 1.3) + 0.03 * Math.sin(a * 17); const X = cx + sq * hw * n, Y = cy + py * hh * n; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.closePath(); g.fill(); g.restore();
  rows.forEach((r, i) => text(SUBT, r, cx, cy + 18 + (i - (rows.length - 1) / 2) * 64, { size: 56, col: K.ink, reveal: rv, seed: 11 + S.t0 * 3 + i, p: 1, stroke: 1.2 }));
}
// model sheet (?test=model)
export function sheet(comp, t) {
  [CAM.x, CAM.y, CAM.s] = [960, 540, 1];
  [BG.f, BG.l, FX, WL, SUBK, SUBT].forEach(clear); clearGroup(SUNG); clearGroup(TK); clearGroup(FF);
  const poses = [{ walk: 0 }, { walk: 1 }, { wave: 1, look: 0.5, waveT: 0.2 }, { worry: 1, smile: -1 }, { hide: 1, peek: 1 }, { look: 0.4 }, { sleep: 1 }];
  poses.forEach((p, i) => tuck(TK, { x: 170 + (i % 4) * 470, y: 470 + Math.floor(i / 4) * 470, s: 0.95, smile: 1, ...p }));
  firefly(FF, FX, 1580, 820, 1.6, t);
  sun(SUNG, 1500, 1000, t, {});
  ['walk', 'walk (2)', 'wave', 'scared', 'hiding / peek', 'looks up', 'asleep'].forEach((s, i) => text(BG.l, s, 170 + (i % 4) * 470 + 40, 520 + Math.floor(i / 4) * 470, { size: 40, col: K.ink, p: 1, seed: 40 + i }));
  text(BG.l, 'Tuck · Firefly — model sheet', 60, 70, { size: 54, font: 'Gaegu', weight: 700, align: 'left', p: 1, seed: 3 });
  comp.paperCam(CAM.x * 0.6, CAM.y * 0.6, CAM.s / 0.6);
  comp.begin(); comp.crayon(BG.f.c); comp.crayon(BG.l.c);
  comp.group(SUNG); comp.group(TK); comp.crayon(FX.c); comp.group(FF);
  comp.finish({ vig: 0.2 });
}
