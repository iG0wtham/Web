// Channel art for "Crayon Bedtime Tales": banner (?art=banner) and profile picture (?art=dp), drawn with the crayon engine.
// Rendered at 1920×1080; the banner is scaled to 2560×1440, the DP cropped square from the centre.
import { layer, clear, line, fill, dab, text, handCircle, ellipse, smooth, CAM, BOIL, W, H } from './crayon.js';
import { group, clearGroup, part, tube } from './rig.js';
import { mulberry, hash } from '/core/lib.js';
import { tuck } from './film.js';

const K = { ink: '#2d3263', leaf: '#5fae4a', olive: '#8a8f3a', sand: '#e9c27a', lemon: '#f6d43c', orange: '#ee8a3a',
  sky: '#7fb6df', pink: '#ef8fa6', reed: '#3f8a52', brown: '#7a4b31', white: '#fbfaf4', red: '#d4483c', violet: '#6a5aa6' };
const WASH_T = [0.2, 0.25, 0.54];
const STAR = group(), BG = { f: layer(), l: layer() }, CH = group(), TX = layer(), WL = layer();

function star(L, x, y, r, seed, col = K.lemon, p = 1) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  fill(L, pts, { col, p, gap: 4, w: 6, seed, over: 2 }); line(L, [...pts, pts[0], pts[1]], { w: 4, col: K.orange, seed: seed + 1, p: 0.8 });
}
// a sleepy crescent moon in a nightcap
function moon(C, cx, cy, R, seed = 5000) {
  // crescent = outer disc minus an offset disc: outer arc outside the inner circle, then the inner arc inside the outer circle
  const ic = [cx + R * 0.48, cy - R * 0.18], ir = R * 0.82, M = 360;
  const arc = (c0, r0, keep) => { const pts = []; for (let i = 0; i < M; i++) { const a = i / M * Math.PI * 2; pts.push([c0[0] + Math.cos(a) * r0, c0[1] + Math.sin(a) * r0]); }
    const k = pts.map(keep); let s0 = k.findIndex((v, i) => v && !k[(i - 1 + M) % M]); const out = []; for (let j = 0; j < M; j++) { const i = (s0 + j) % M; if (!k[i]) break; out.push(pts[i]); } return out; };
  const outer = arc([cx, cy], R, ([x, y]) => Math.hypot(x - ic[0], y - ic[1]) > ir);
  let inner = arc(ic, ir, ([x, y]) => Math.hypot(x - cx, y - cy) < R);
  const dEnd = (q) => Math.hypot(q[0] - outer[outer.length - 1][0], q[1] - outer[outer.length - 1][1]);
  if (dEnd(inner[0]) > dEnd(inner[inner.length - 1])) inner = inner.reverse();
  const poly = [...outer, ...inner];
  part(C, poly, { col: K.lemon, p: 0.95, gap: 8, w: 10, seed, cross: true }, { w: 8, col: K.orange, seed: seed + 1 });
  // face: closed sleepy eye, smile, cheek
  const fx = cx - R * 0.55, fy = cy - R * 0.05;
  line(C.l, [[fx - 22, fy - 6], [fx - 6, fy + 6], [fx + 12, fy - 4]], { w: 6, seed: seed + 2 });
  line(C.l, [[fx - 6, fy + 46], [fx + 12, fy + 58], [fx + 30, fy + 50]], { w: 5.5, seed: seed + 3 });
  dab(C.f, fx + 4, fy + 28, 15, { col: K.pink, p: 0.8, seed: seed + 4 });
  // nightcap: a floppy pink cone with a white pompom
  const tip = [cx + R * 0.35, cy - R * 1.25];
  const cap = smooth([[cx - R * 0.75, cy - R * 0.55], [cx - R * 0.2, cy - R * 1.05], tip, [cx + R * 0.05, cy - R * 0.8], [cx - R * 0.35, cy - R * 0.35]], 8);
  part(C, cap, { col: K.pink, p: 0.9, gap: 7, w: 9, seed: seed + 5 }, { w: 7, seed: seed + 6 });
  part(C, tube([[cx - R * 0.8, cy - R * 0.5], [cx - R * 0.3, cy - R * 0.28]], 34, 34), { col: K.white, p: 0.9, gap: 5, w: 8, seed: seed + 7 }, { w: 6, seed: seed + 8 });
  part(C, handCircle(tip[0] + 6, tip[1] + 8, 26, seed + 9, 0, 18), { col: K.white, p: 0.95, gap: 4, w: 7, seed: seed + 10 }, { w: 6, seed: seed + 11 });
}
// a crayon stick lying at an angle
function crayonStick(C, x, y, ang, col, seed, len = 230) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const body = [P(0, -22), P(len, -22), P(len, 22), P(0, 22)];
  part(C, body, { col, p: 0.95, gap: 6, w: 9, seed }, { w: 6, seed: seed + 1 });
  part(C, [P(len, -22), P(len + 52, -4), P(len + 52, 4), P(len, 22)], { col, p: 0.95, gap: 5, w: 8, seed: seed + 2 }, { w: 6, seed: seed + 3 });
  part(C, [P(40, -23), P(110, -23), P(110, 23), P(40, 23)], { col: K.white, p: 0.85, gap: 5, w: 7, seed: seed + 4 }, { w: 5, seed: seed + 5 });
  line(C.l, [P(52, -8), P(98, -8)], { w: 4, col, seed: seed + 6 }); line(C.l, [P(52, 8), P(86, 8)], { w: 4, col, seed: seed + 7 });
}
function stars(L, n, seed, box, rmin = 8, rmax = 20, avoid = null) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]);
    if (avoid && x > avoid[0] && x < avoid[2] && y > avoid[1] && y < avoid[3]) continue;
    if (r() < 0.35) star(L, x, y, rmin + r() * (rmax - rmin), seed + i * 7);
    else { const rr = 4 + r() * 6; line(L, [[x - rr, y], [x + rr, y]], { w: 3.5, col: K.white, seed: seed + i * 3, wob: .2 }); line(L, [[x, y - rr], [x, y + rr]], { w: 3.5, col: K.white, seed: seed + i * 3 + 1, wob: .2 }); }
  }
}
function hills(L, f) {
  const h1 = smooth([[-100, 900], [300, 800], [700, 860], [1100, 780], [1500, 850], [2050, 790]], 10, false);
  fill(L, [...h1, [2050, 1200], [-100, 1200]], { col: K.leaf, p: 0.75, gap: 11, w: 12, seed: 6100, boil: 0 });
  line(f, h1, { w: 7, seed: 6101, boil: .6 });
  const h2 = smooth([[-100, 980], [400, 930], [900, 990], [1400, 940], [2050, 990]], 10, false);
  fill(L, [...h2, [2050, 1200], [-100, 1200]], { col: K.reed, p: 0.7, gap: 10, w: 11, seed: 6102, boil: 0 });
  line(f, h2, { w: 7, seed: 6103, boil: .6 });
}
function compose(comp) {
  comp.paperCam(CAM.x * 0.6, CAM.y * 0.6, CAM.s / 0.6);
  comp.begin(); comp.crayon(BG.f.c); comp.crayon(BG.l.c);
  comp.wash(WL.c, { color: WASH_T, gran: 0.25, edge: 1.0 });
  comp.group(CH); comp.crayon(TX.c); comp.group(STAR);
  comp.finish({ vig: 0.22 });
}
function nightWash(L) { const g = L.g; g.save(); g.fillStyle = '#000'; g.globalAlpha = 0.74; g.fillRect(0, 0, W, H);
  const R = mulberry(9); for (let i = 0; i < 24; i++) { const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(600, y + 20, 1300, y - 20, W, y + 10); g.lineWidth = 10 + R() * 30; g.globalCompositeOperation = R() < .5 ? 'source-over' : 'destination-out'; g.globalAlpha = .06 + R() * .08; g.stroke(); } g.restore(); }

export function banner(comp, t) {
  [CAM.x, CAM.y, CAM.s] = [960, 540, 1]; BOIL.amp = 0.6;
  [BG.f, BG.l, TX, WL].forEach(clear); clearGroup(CH); clearGroup(STAR);
  hills(BG.f, BG.l); nightWash(WL);
  stars(STAR.f, 70, 777, [30, 30, 1890, 760], 10, 22, [360, 330, 1560, 720]);
  // safe area (visible on every device) ≈ x 380–1540, y 381–698: moon + title inside it
  moon(CH, 545, 560, 82);
  text(TX, 'Crayon Bedtime Tales', 1030, 535, { size: 86, font: 'Gaegu', weight: 700, col: K.lemon, p: 1, stroke: 3, seed: 31 });
  text(TX, 'gentle crayon stories for little ones', 1030, 598, { size: 40, col: K.white, p: 1, seed: 32 });
  // outside the safe area (TV / desktop): crayons, a tiny sleeping turtle
  crayonStick(CH, 80, 1010, -0.25, K.red, 6200); crayonStick(CH, 200, 1060, -0.12, K.sky, 6210); crayonStick(CH, 1500, 1050, 0.12, K.lemon, 6220); crayonStick(CH, 1640, 1000, 0.3, K.violet, 6230);
  tuck(CH, { x: 1700, y: 860, s: 0.55, sleep: 1, smile: 1, dir: -1 });
  compose(comp);
}
export function dp(comp, t) {
  [CAM.x, CAM.y, CAM.s] = [960, 540, 1]; BOIL.amp = 0.6;
  [BG.f, BG.l, TX, WL].forEach(clear); clearGroup(CH); clearGroup(STAR);
  nightWash(WL);
  // the circle crop keeps the centre ~1000 px: a big sleepy moon, stars, one crayon
  stars(STAR.f, 26, 4242, [480, 60, 1440, 1020], 14, 28, [640, 240, 1260, 860]);
  moon(CH, 1010, 590, 300, 5100);
  crayonStick(CH, 760, 930, -0.35, K.red, 6300, 260);
  compose(comp);
}
