// "The Young Boy" — vertical Shorts cut. A fast-cut 3D history short built from primitives in three.js.
// window.drawFrame(t) renders one deterministic frame. Shots are cut on narration lines (timing.json).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920, SCALE = window.RENDER_SCALE || 0.75;
const TM = window.TIMING;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ── deterministic helpers ────────────────────────────────────────────────────
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (i, s) => { const r = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return r - Math.floor(r); };
const noise = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = k => Math.pow(clamp(k), 3);
const win = (t, a, b) => clamp((t - a) / (b - a));
const lerpV = (a, b, k) => V3(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
const back = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

// ── renderer, scene, post ────────────────────────────────────────────────────
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W * SCALE, H * SCALE, false);
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 6000);

const rt = new THREE.WebGLRenderTarget(W * SCALE, H * SCALE, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W * SCALE, H * SCALE);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W * SCALE, H * SCALE), 0.32, 0.55, 0.9);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uVig: { value: 0.55 }, uSat: { value: 1.1 },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uFade: { value: 0 }, uAb: { value: 0.0015 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uFlash,uVig,uSat,uFade,uAb; uniform vec3 uTint,uLift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv-0.5;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d*uAb).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d*uAb).b;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, uSat);
      c = c*uTint + uLift*(1.0-c);
      c = (c - 0.5)*1.06 + 0.5;
      float v = smoothstep(0.85, 0.2, length(d*vec2(1.0,0.75)));
      c *= mix(1.0, v, uVig);
      c += (h(vUv*vec2(1080.,1920.) + uTime*91.7)-0.5)*0.035;
      c = mix(c, vec3(1.0,0.96,0.9), uFlash);
      c *= 1.0-uFade;
      gl_FragColor = vec4(c,1.0);
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ── textures ─────────────────────────────────────────────────────────────────
function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
const groundTex = canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(3); g.fillStyle = '#8a6a3e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const x = r() * w, y = r() * h, s = 2 + r() * 14; g.fillStyle = `hsla(${30 + r() * 30},${30 + r() * 25}%,${28 + r() * 22}%,${0.15 + r() * .3})`; g.beginPath(); g.ellipse(x, y, s, s * (.4 + r() * .6), r() * 3, 0, 6.28); g.fill(); }
  g.strokeStyle = 'rgba(110,120,50,.35)'; for (let i = 0; i < 5000; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 6, y - 4 - r() * 10); g.stroke(); }
}, 120);
const stoneTex = canvasTex(512, 512, (g, w, h) => {
  const r = rng(5); g.fillStyle = '#b89a78'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = `hsl(30,${18 + r() * 10}%,${52 + r() * 10}%)`; g.fillRect(x + 2, y + 2, 124, 124); }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(60,40,20,${r() * .08})`; g.fillRect(r() * w, r() * h, 3, 3); }
}, 1);
stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(10, 20);
const mapTex = canvasTex(1024, 640, (g, w, h) => {
  g.fillStyle = '#d8c08a'; g.fillRect(0, 0, w, h);
  const r = rng(9); for (let i = 0; i < 800; i++) { g.fillStyle = `rgba(90,60,20,${r() * .08})`; g.beginPath(); g.arc(r() * w, r() * h, r() * 30, 0, 6.28); g.fill(); }
  g.strokeStyle = '#5a3a18'; g.lineWidth = 6; g.fillStyle = '#c7a868';
  g.beginPath(); g.moveTo(300, 40); g.bezierCurveTo(420, 120, 520, 260, 470, 420); g.bezierCurveTo(450, 520, 520, 600, 560, 620); g.bezierCurveTo(640, 560, 700, 420, 760, 300); g.bezierCurveTo(800, 200, 820, 90, 880, 40); g.stroke();
  const mark = (x, y, c, l) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 26, 0, 6.28); g.fill(); g.lineWidth = 4; g.strokeStyle = '#2a1608'; g.stroke(); g.fillStyle = '#2a1608'; g.font = 'bold 34px "Liberation Serif",serif'; g.fillText(l, x + 34, y + 12); };
  mark(430, 200, '#2f8a5c', 'CHERA'); mark(700, 220, '#c3361c', 'CHOLA'); mark(560, 470, '#e0a020', 'PANDYA');
  g.strokeStyle = '#8a1a10'; g.lineWidth = 10; g.setLineDash([22, 14]);
  [[440, 230], [690, 250], [380, 330], [760, 330], [620, 150]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(560 + (x - 560) * .25, 470 + (y - 470) * .25); g.stroke(); });
});
const leafTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#3f6a2a'; g.beginPath(); g.moveTo(w / 2, 0); g.quadraticCurveTo(w, h * .4, w / 2, h); g.quadraticCurveTo(0, h * .4, w / 2, 0); g.fill();
  g.strokeStyle = '#2a4a1a'; g.lineWidth = 4; for (let y = 30; y < h; y += 26) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(10, y + 30); g.moveTo(w / 2, y); g.lineTo(w - 10, y + 30); g.stroke(); }
});
const dustTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,210,1)'); r.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

function flagTex(kind, bg, fg) {
  return canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = 14;
    g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18);
    if (kind === 'fish') { // the twin fish of the Pandyas
      for (const s of [1, -1]) { g.save(); g.translate(w / 2, h / 2 + s * 48); g.scale(-s, 1);
        g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-20, -70, 110, 0); g.lineTo(160, -40); g.lineTo(140, 0); g.lineTo(160, 40); g.lineTo(110, 0); g.quadraticCurveTo(-20, 70, -150, 0); g.fill();
        g.fillStyle = bg; g.beginPath(); g.arc(-100, -6, 9, 0, 6.28); g.fill(); g.fillStyle = fg; g.restore(); }
    } else if (kind === 'bow') { // the bow of the Cheras
      g.beginPath(); g.moveTo(180, 40); g.quadraticCurveTo(420, h / 2, 180, h - 40); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.moveTo(180, 40); g.lineTo(180, h - 40); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(110, h / 2); g.lineTo(400, h / 2); g.stroke();
      g.beginPath(); g.moveTo(420, h / 2); g.lineTo(385, h / 2 - 22); g.lineTo(385, h / 2 + 22); g.fill();
    } else if (kind === 'tiger') { // the tiger of the Cholas
      g.beginPath(); g.moveTo(90, 210); g.quadraticCurveTo(120, 130, 220, 140); g.quadraticCurveTo(300, 150, 350, 110); g.lineTo(365, 80); g.lineTo(380, 105);
      g.quadraticCurveTo(430, 105, 425, 150); g.lineTo(405, 180); g.quadraticCurveTo(380, 195, 360, 185); g.lineTo(370, 250); g.lineTo(340, 250); g.lineTo(325, 200);
      g.quadraticCurveTo(250, 215, 190, 205); g.lineTo(180, 255); g.lineTo(150, 255); g.lineTo(150, 220); g.quadraticCurveTo(80, 190, 50, 110); g.lineTo(65, 105); g.quadraticCurveTo(80, 180, 90, 210); g.fill();
      g.strokeStyle = bg; g.lineWidth = 9; for (let x = 170; x < 330; x += 32) { g.beginPath(); g.moveTo(x, 142); g.lineTo(x + 12, 205); g.stroke(); }
    } else if (kind === 'sun') { g.beginPath(); g.arc(w / 2, h / 2, 60, 0, 6.28); g.fill(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 80, h / 2 + Math.sin(a) * 80); g.lineTo(w / 2 + Math.cos(a) * 120, h / 2 + Math.sin(a) * 120); g.stroke(); } }
    else if (kind === 'moon') { g.beginPath(); g.arc(w / 2, h / 2, 90, 0, 6.28); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(w / 2 + 40, h / 2 - 20, 80, 0, 6.28); g.fill(); }
    else if (kind === 'diamond') { g.beginPath(); g.moveTo(w / 2, 60); g.lineTo(w / 2 + 100, h / 2); g.lineTo(w / 2, h - 60); g.lineTo(w / 2 - 100, h / 2); g.closePath(); g.fill(); }
    else if (kind === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 - 1.57, rr = i % 2 ? 50 : 120; g.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); } g.fill(); }
    else if (kind === 'trident') { g.fillRect(w / 2 - 8, 60, 16, 200); for (const dx of [-70, 0, 70]) { g.beginPath(); g.moveTo(w / 2 + dx, 40); g.lineTo(w / 2 + dx - 18, 100); g.lineTo(w / 2 + dx + 18, 100); g.fill(); } g.fillRect(w / 2 - 78, 110, 156, 14); }
  });
}
const FLAGT = {
  fish: flagTex('fish', '#e8a317', '#1d3f8a'), bow: flagTex('bow', '#1f6e4e', '#f1d27a'), tiger: flagTex('tiger', '#b8261a', '#f2b33a'),
  c1: flagTex('sun', '#5b2a7a', '#f4c64a'), c2: flagTex('moon', '#2b3f7a', '#e9e2c8'), c3: flagTex('diamond', '#7a3a1a', '#e8c070'),
  c4: flagTex('star', '#335a2a', '#e8d070'), c5: flagTex('trident', '#6a1a3a', '#e9c0a0'),
};

// ── materials ────────────────────────────────────────────────────────────────
const matCache = {};
const M = (color, o = {}) => { const k = color + JSON.stringify(o); return matCache[k] ||= new THREE.MeshStandardMaterial({ color, roughness: .65, ...o }); };
const GOLD = M('#d9a632', { metalness: .85, roughness: .3 }), DARK = M('#1a120c', { roughness: .9 }), WHITE = M('#ddd5ca', { roughness: .5 });
const IRON = M('#9aa3ad', { metalness: .9, roughness: .25 }), WOOD = M('#5a3a22', { roughness: .8 });
function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }
const G = {
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14), sph: (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z), cyl: (a, b, h, s = 20, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open),
};

// ── people ───────────────────────────────────────────────────────────────────
function makePerson(o) {
  const skin = M(o.skin || '#8a5636', { roughness: .55 });
  const cloth = M(o.dhoti || '#e8e0cc', { side: THREE.DoubleSide, roughness: .8 });
  const P = { o, root: new THREE.Group() };
  const hips = P.hips = new THREE.Group(); hips.position.y = .92; P.root.add(hips);
  P.legs = [-1, 1].map(side => {
    const hip = new THREE.Group(); hip.position.set(side * .11, 0, 0); hips.add(hip);
    const th = mesh(G.cap(.075, .3), skin); th.position.y = -.22; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -.44; hip.add(knee);
    const sh = mesh(G.cap(.062, .3), skin); sh.position.y = -.2; knee.add(sh);
    const ft = mesh(G.box(.11, .06, .24), M('#4a2c18')); ft.position.set(0, -.43, .06); knee.add(ft);
    return { hip, knee };
  });
  const dh = mesh(G.cyl(.25, .34, .62, 22, true), cloth); dh.position.y = -.27; hips.add(dh);
  const border = mesh(G.cyl(.345, .345, .07, 22, true), M(o.border || '#d9a632', { side: THREE.DoubleSide })); border.position.y = -.55; hips.add(border);
  const spine = P.spine = new THREE.Group(); hips.add(spine);
  const torso = mesh(G.cap(.2, .34), o.shirt ? M(o.shirt) : skin); torso.position.y = .32; torso.scale.set(1.18, 1, .82); spine.add(torso);
  const belt = mesh(G.cyl(.255, .255, .09), M(o.belt || '#d9a632', { metalness: .5, roughness: .4 })); belt.position.y = .04; belt.scale.z = .85; spine.add(belt);
  if (o.sash) { const s = mesh(G.box(.07, .7, .02), M(o.sash)); s.position.set(0, .34, .17); s.rotation.z = .65; spine.add(s); }
  const neckl = mesh(new THREE.TorusGeometry(.15, .022, 8, 24), GOLD); neckl.position.set(0, .56, .05); neckl.rotation.x = 1.25; spine.add(neckl);
  if (o.shirt) { const coll = mesh(new THREE.TorusGeometry(.17, .04, 8, 24), M(o.trim || '#d9a632', { metalness: .5 })); coll.position.set(0, .6, 0); coll.rotation.x = 1.5708; spine.add(coll); }
  const neck = P.neck = new THREE.Group(); neck.position.y = .66; spine.add(neck);
  const nm = mesh(G.cyl(.075, .085, .16), skin); nm.position.y = .06; neck.add(nm);
  const head = P.head = new THREE.Group(); head.position.y = .26; neck.add(head);
  const skull = mesh(G.sph(.19, 32, 24), skin); skull.scale.set(1, 1.12, 1.04); head.add(skull);
  const hair = mesh(new THREE.SphereGeometry(.198, 32, 16, 0, 6.2832, 0, Math.PI * .5), DARK); hair.rotation.x = -.35; hair.position.set(0, .015, -.01); hair.scale.set(1, 1.14, 1.06); head.add(hair);
  if (o.longHair) { const bun = mesh(G.sph(.09), DARK); bun.position.set(0, .05, -.2); head.add(bun); }
  P.eyes = [-1, 1].map(side => {
    const g = new THREE.Group(); g.position.set(side * .072, .025, .165); head.add(g);
    const w = mesh(G.sph(.046, 20, 14), WHITE, false); w.scale.set(1, 1.1, .55); g.add(w);
    const p = mesh(G.sph(.026, 16, 12), M('#140c08', { roughness: .2 }), false); p.position.z = .022; g.add(p);
    const glint = mesh(G.sph(.007, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), false); glint.position.set(.008, .01, .036); g.add(glint);
    const lid = mesh(new THREE.SphereGeometry(.05, 20, 10, 0, 6.2832, 0, Math.PI * .5), skin, false); lid.scale.set(1, 1.1, .62); lid.rotation.x = -.2; g.add(lid);
    const brow = mesh(G.box(.085, .017, .025), DARK, false); brow.position.set(0, .07, .01); g.add(brow);
    return { g, p, lid, brow, side };
  });
  const nose = mesh(G.sph(.032), skin); nose.scale.set(1, 1.15, 1.25); nose.position.set(0, -.03, .19); head.add(nose);
  const mouth = P.mouth = new THREE.Group(); mouth.position.set(0, -.1, .172); head.add(mouth);
  const lips = mesh(G.box(.085, .016, .03), M('#5a2a20'), false); mouth.add(lips);
  const inner = P.inner = mesh(G.box(.075, .06, .02), M('#2a0a08'), false); inner.position.y = -.02; inner.scale.y = .01; mouth.add(inner);
  [-1, 1].forEach(s => { const e = mesh(G.sph(.042), skin); e.scale.set(.45, 1, .8); e.position.set(s * .19, 0, 0); head.add(e);
    const ring = mesh(new THREE.TorusGeometry(.025, .007, 6, 16), GOLD, false); ring.position.set(s * .2, -.06, 0); ring.rotation.y = 1.57; head.add(ring); });
  if (o.beard) { const b = mesh(new THREE.SphereGeometry(.19, 24, 16, 0, 6.2832, Math.PI * .52, Math.PI * .48), DARK); b.scale.set(1.04, 1.15, 1.1); b.position.set(0, -.01, .015); head.add(b);
    const mus = mesh(G.box(.14, .03, .04), DARK, false); mus.position.set(0, -.07, .185); mus.rotation.z = 0; head.add(mus);
    lips.position.y = -.008; }
  // headwear
  const crown = P.crown = new THREE.Group(); crown.position.y = .14; head.add(crown);
  if (o.crown === 'kireedam') {
    { const band = mesh(G.cyl(.205, .2, .09, 28), GOLD); band.position.y = .02; crown.add(band); }
    const c1 = mesh(G.cyl(.12, .19, .16, 28), GOLD); c1.position.y = .14; crown.add(c1);
    const c2 = mesh(G.cyl(.05, .12, .12, 28), GOLD); c2.position.y = .28; crown.add(c2);
    const tip = mesh(G.sph(.045), GOLD); tip.position.y = .37; tip.scale.y = 1.4; crown.add(tip);
    [[0, .03, .2, '#c0182a'], [0, .15, .17, '#1a8a4a'], [-.14, .03, .14, '#1a5ac0'], [.14, .03, .14, '#1a5ac0']].forEach(([x, y, z, c]) => {
      const j = mesh(G.sph(.024), M(c, { roughness: .1, metalness: .2, emissive: c, emissiveIntensity: .15 }), false); j.position.set(x, y, z); crown.add(j); });
  } else if (o.crown === 'king') {
    const c1 = mesh(G.cyl(.235, .2, .14, 28), M(o.crownColor || '#d9a632', { metalness: .8, roughness: .3 })); c1.position.y = .05; crown.add(c1);
    const dome = mesh(new THREE.SphereGeometry(.17, 28, 12, 0, 6.2832, 0, Math.PI / 2), M(o.cap || '#7a1a14', { roughness: .8 })); dome.position.y = .1; dome.scale.y = .9; crown.add(dome);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, sp = new THREE.Mesh(new THREE.ConeGeometry(.035, .16, 4), GOLD); sp.position.set(Math.sin(a) * .225, .19, Math.cos(a) * .225); crown.add(sp); }
    const fin = mesh(G.sph(.04), GOLD); fin.position.y = .27; crown.add(fin);
    const gem = mesh(G.sph(.03), M(o.gem || '#c0182a', { roughness: .1, emissive: o.gem || '#c0182a', emissiveIntensity: .2 }), false); gem.position.set(0, .06, .225); crown.add(gem);
  } else if (o.crown === 'turban') {
    const t1 = mesh(new THREE.TorusGeometry(.17, .07, 10, 24), M(o.crownColor || '#e8e0cc')); t1.rotation.x = 1.57; t1.position.y = .0; crown.add(t1);
    const t2 = mesh(G.sph(.18), M(o.crownColor || '#e8e0cc')); t2.scale.y = .7; t2.position.y = .05; crown.add(t2);
  } else if (o.crown === 'helmet') {
    const h1 = mesh(new THREE.SphereGeometry(.215, 24, 12, 0, 6.2832, 0, Math.PI / 2), IRON); h1.scale.y = 1.15; h1.position.y = -.05; crown.add(h1);
    const sp = mesh(new THREE.ConeGeometry(.04, .16, 12), IRON); sp.position.y = .22; crown.add(sp);
  }
  // arms
  P.arms = [-1, 1].map(side => {
    const sh = new THREE.Group(); sh.position.set(side * .29, .56, 0); spine.add(sh);
    const up = mesh(G.cap(.066, .24), o.shirt && o.sleeves ? M(o.shirt) : skin); up.position.y = -.17; sh.add(up);
    const band = mesh(G.cyl(.075, .075, .04), GOLD); band.position.y = -.12; sh.add(band);
    const el = new THREE.Group(); el.position.y = -.34; sh.add(el);
    const fo = mesh(G.cap(.056, .22), skin); fo.position.y = -.15; el.add(fo);
    const br = mesh(G.cyl(.065, .065, .04), GOLD); br.position.y = -.25; el.add(br);
    const hand = mesh(G.sph(.068), skin); hand.position.y = -.32; hand.scale.set(.9, 1.05, 1); el.add(hand);
    const held = new THREE.Group(); held.position.y = -.33; el.add(held);
    return { sh, el, held, side };
  });
  if (o.held === 'sword') {
    const s = new THREE.Group();
    const blade = mesh(G.box(.05, .85, .012), M('#d6dde5', { metalness: 1, roughness: .15 })); blade.position.y = .55; s.add(blade);
    const tip = mesh(new THREE.ConeGeometry(.035, .1, 4), M('#d6dde5', { metalness: 1, roughness: .15 })); tip.position.y = 1.02; tip.rotation.y = .785; tip.scale.z = .25; s.add(tip);
    const guard = mesh(G.box(.22, .035, .05), GOLD); guard.position.y = .1; s.add(guard);
    const grip = mesh(G.cyl(.022, .022, .16), WOOD); grip.position.y = 0; s.add(grip);
    const pommel = mesh(G.sph(.035), GOLD); pommel.position.y = -.09; s.add(pommel);
    P.sword = s; P.arms[0].held.add(s); s.rotation.x = 1.57;
  }
  if (o.held === 'scepter') { const s = new THREE.Group(); const r = mesh(G.cyl(.02, .02, 1.1), GOLD); r.position.y = .2; s.add(r); const k = mesh(G.sph(.06), M('#c0182a', { emissive: '#c0182a', emissiveIntensity: .3 })); k.position.y = .78; s.add(k); P.arms[0].held.add(s); }
  P.root.scale.setScalar(o.scale || 1);
  return P;
}
// pose: all optional; angles in radians
function pose(P, p = {}, t = 0) {
  const br = p.breathe ?? 1, sd = P.o.seed || 1;
  P.hips.position.y = .92 + (p.hipY || 0) + Math.sin(t * 2.2 + sd) * .004 * br;
  P.hips.rotation.set(p.hipX || 0, p.hipYaw || 0, 0);
  P.spine.rotation.set((p.lean || 0) + Math.sin(t * 2.2 + sd) * .01 * br, p.twist || 0, p.side || 0);
  P.neck.rotation.set(p.nod || 0, 0, 0);
  P.head.rotation.set((p.pitch || 0) + (noise(t * .7, sd) - .5) * .04 * br, (p.yaw || 0) + (noise(t * .6, sd + 3) - .5) * .06 * br, p.roll || 0);
  const arm = (A, a = {}) => { A.sh.rotation.set(a.x ?? .05, a.y ?? 0, (a.z ?? .12) * A.side); A.el.rotation.set(a.el ?? -.15, 0, 0); A.held.rotation.set(a.hx || 0, 0, a.hz || 0); };
  arm(P.arms[0], p.armR); arm(P.arms[1], p.armL);
  const leg = (L, a = {}) => { L.hip.rotation.set(a.x || 0, 0, a.z || 0); L.knee.rotation.set(a.k || 0, 0, 0); };
  leg(P.legs[0], p.legR); leg(P.legs[1], p.legL);
  P.inner.scale.y = Math.max(.01, p.mouth || 0); P.inner.position.y = -.02 - (p.mouth || 0) * .02;
  const blink = (p.blink ?? true) && (((t + sd * .37) % 3.1) < .12) ? 1 : 0;
  P.eyes.forEach(e => {
    e.p.position.x = (p.lookX || 0) * .012; e.p.position.y = (p.lookY || 0) * .012;
    e.lid.rotation.x = -.2 - (1 - Math.max(blink, p.squint || 0)) * 1.2;
    e.brow.rotation.z = (p.angry || 0) * -.45 * e.side + (p.worry || 0) * .3 * e.side; e.brow.position.y = .07 - (p.angry || 0) * .012 + (p.raise || 0) * .02;
  });
}
function walk(phase, amt = 1, run = 0) {
  const s = Math.sin(phase), c = Math.cos(phase), a = amt * (.45 + run * .35);
  return { legR: { x: -s * a, k: Math.max(0, c) * (.5 + run * .6) * amt }, legL: { x: s * a, k: Math.max(0, -c) * (.5 + run * .6) * amt },
    armR: { x: s * a * .8, z: .12, el: -.25 - run * .9 }, armL: { x: -s * a * .8, z: .12, el: -.25 - run * .9 }, hipY: -Math.abs(s) * .03 * amt, lean: run * .25 };
}
const sitPose = { hipY: -.2, legR: { x: -1.5, k: 1.2 }, legL: { x: -1.5, k: 1.2 }, armR: { x: -.6, z: .2, el: -.6 }, armL: { x: -.6, z: .2, el: -.6 } };

// ── cast ─────────────────────────────────────────────────────────────────────
const BOY = makePerson({ skin: '#8e5a38', dhoti: '#f1ebdc', border: '#c79a2a', crown: 'kireedam', held: 'sword', scale: .92, seed: 2, sash: '#b8261a' });
const CHERA = makePerson({ skin: '#7a4a2e', dhoti: '#1f4e3e', border: '#d9a632', shirt: '#1f6e4e', sleeves: true, crown: 'king', crownColor: '#c9a03a', gem: '#1a8a4a', cap: '#1f4e3e', beard: true, held: 'scepter', scale: 1.12, seed: 5 });
const CHOLA = makePerson({ skin: '#7a4a2e', dhoti: '#6a1a12', border: '#e8b83a', shirt: '#a3241a', sleeves: true, crown: 'king', crownColor: '#e0b040', gem: '#d02020', beard: true, held: 'scepter', scale: 1.15, seed: 7 });
const CHIEFS = ['#5b2a7a', '#2b3f7a', '#7a3a1a', '#335a2a', '#6a1a3a'].map((c, i) => makePerson({ skin: '#7d4c30', dhoti: '#2a2420', shirt: c, sleeves: true, crown: 'turban', crownColor: c, beard: i % 2 === 0, scale: 1.0, seed: 11 + i }));
const COURT = [0, 1, 2, 3, 4, 5].map(i => makePerson({ skin: '#83513a', dhoti: '#eee6d4', crown: 'turban', crownColor: ['#e8e0cc', '#c9a03a', '#b8261a'][i % 3], beard: i % 2 === 1, scale: 1.0, seed: 20 + i }));
[BOY, CHERA, CHOLA, ...CHIEFS, ...COURT].forEach(p => scene.add(p.root));
// the hands that crown the boy
const crowner = new THREE.Group(); scene.add(crowner);
[-1, 1].forEach(s => { const a = mesh(G.cap(.045, .6), M('#7a4a30')); a.position.set(s * .33, .42, -.04); a.rotation.z = s * -.6; crowner.add(a);
  const h = mesh(G.sph(.055), M('#7a4a30')); h.position.set(s * .22, .12, 0); crowner.add(h);
  const sl = mesh(G.cyl(.07, .08, .4), M('#f1ebdc')); sl.position.set(s * .55, .8, -.06); sl.rotation.z = s * -.6; crowner.add(sl); });
const flyingCrown = makePerson({ crown: 'kireedam' }).crown; // reuse the crown geometry
flyingCrown.parent.remove(flyingCrown); crowner.add(flyingCrown); flyingCrown.scale.setScalar(.92);

// ── banners ──────────────────────────────────────────────────────────────────
const banners = [];
function makeBanner(tex, h = 4.2, w = 1.7, fh = 1.05) {
  const g = new THREE.Group();
  const pole = mesh(G.cyl(.035, .045, h, 10), WOOD); pole.position.y = h / 2; g.add(pole);
  const knob = mesh(G.sph(.08), GOLD); knob.position.y = h + .05; g.add(knob);
  const geo = new THREE.PlaneGeometry(w, fh, 20, 10); geo.translate(w / 2, 0, 0);
  const flag = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9 }));
  flag.position.set(.03, h - fh / 2 - .1, 0); g.add(flag);
  const B = { g, flag, base: geo.attributes.position.array.slice(), seed: banners.length * 1.7, w };
  banners.push(B); scene.add(g); return B;
}
function waveBanners(t) {
  for (const B of banners) {
    if (!B.g.visible) continue;
    const a = B.flag.geometry.attributes.position, s = B.seed;
    for (let i = 0; i < a.count; i++) { const x = B.base[i * 3], y = B.base[i * 3 + 1], k = x / B.w;
      a.array[i * 3 + 2] = Math.sin(x * 3.2 - t * 6.5 + s) * .14 * k + Math.sin(y * 4 + t * 3 + s) * .04 * k;
      a.array[i * 3 + 1] = y - k * k * .12; }
    a.needsUpdate = true; B.flag.geometry.computeVertexNormals();
  }
}
const BN = { chera: makeBanner(FLAGT.bow, 5.2, 2.2, 1.35), chola: makeBanner(FLAGT.tiger, 5.2, 2.2, 1.35),
  chiefs: ['c1', 'c2', 'c3', 'c4', 'c5'].map(k => makeBanner(FLAGT[k], 3.6, 1.3, .8)),
  fish: makeBanner(FLAGT.fish, 4.6, 1.9, 1.15), fish2: makeBanner(FLAGT.fish, 4.6, 1.9, 1.15) };
// army banners (bigger, carried over each block)
const ARMY_KEYS = ['bow', 'tiger', 'c1', 'c2', 'c3', 'c4', 'c5'];
const ARMY_COL = ['#1f6e4e', '#a3241a', '#5b2a7a', '#2b3f7a', '#7a3a1a', '#335a2a', '#6a1a3a'];
const armyBanners = ARMY_KEYS.map(k => [0, 1, 2].map(() => makeBanner(FLAGT[k], 6.5, 2.6, 1.6)));
const pandyaBanners = [0, 1, 2, 3, 4].map(() => makeBanner(FLAGT.fish, 6.5, 2.6, 1.6));
const fallen = [0, 1, 2, 3].map((_, i) => makeBanner(FLAGT[ARMY_KEYS[i]], 4.5, 1.8, 1.1));

// ── soldiers (instanced) ─────────────────────────────────────────────────────
const MAXS = 1400;
const SI = {
  body: new THREE.InstancedMesh(G.cap(.22, .7), new THREE.MeshStandardMaterial({ roughness: .8 }), MAXS),
  head: new THREE.InstancedMesh(G.sph(.17, 14, 10), M('#7d4c30'), MAXS),
  helm: new THREE.InstancedMesh(new THREE.SphereGeometry(.19, 14, 8, 0, 6.2832, 0, Math.PI / 2), M('#8a8f96', { metalness: .7, roughness: .35 }), MAXS),
  spear: new THREE.InstancedMesh(G.cyl(.02, .02, 2.6, 6), WOOD, MAXS),
  tip: new THREE.InstancedMesh(new THREE.ConeGeometry(.05, .25, 6), IRON, MAXS),
  shield: new THREE.InstancedMesh(G.cyl(.32, .32, .06, 18), new THREE.MeshStandardMaterial({ roughness: .6, metalness: .2 }), MAXS),
  legs: new THREE.InstancedMesh(G.cap(.08, .55), M('#6e4430'), MAXS * 2),
};
Object.values(SI).forEach(m => { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(1, 1, 1), _c = new THREE.Color();
let SN = 0;
function soldierBegin() { SN = 0; }
// p: position, yaw, phase (walk), lean, color, flyK (0..1 knocked away), fall dir
function soldier(p, yaw, phase, col, o = {}) {
  if (SN >= MAXS) return;
  const i = SN++, bob = Math.abs(Math.sin(phase)) * .06, run = o.run || 0, lean = o.lean || run * .3;
  const fly = o.fly || 0; let px = p.x, py = p.y + bob, pz = p.z, rx = lean, rz = 0;
  if (fly > 0) { const d = o.flyDir || V3(0, 0, -1); px += d.x * fly * 9; pz += d.z * fly * 9; py += Math.sin(Math.min(1, fly) * Math.PI) * 3.5 * (o.flyH || 1); rx -= fly * 5 * (o.spin || 1); rz += fly * 2 * (o.spinZ || .3); }
  const base = new THREE.Matrix4().compose(V3(px, py, pz), _q.setFromEuler(_e.set(rx, yaw, rz, 'YXZ')), _s.set(1, 1, 1));
  const put = (m, idx, x, y, z, ex = 0, ey = 0, ez = 0, sx = 1, sy = 1, sz = 1) => {
    _m.compose(V3(x, y, z), _q.setFromEuler(_e.set(ex, ey, ez)), _s.set(sx, sy, sz)); _m.premultiply(base); m.setMatrixAt(idx, _m); };
  put(SI.body, i, 0, 1.15, 0, 0, 0, 0, 1, 1, .8); SI.body.setColorAt(i, _c.set(col));
  put(SI.head, i, 0, 1.78, 0); put(SI.helm, i, 0, 1.8, 0);
  const sw = Math.sin(phase) * (.45 + run * .3);
  put(SI.legs, i * 2, -.1, .42, 0, sw, 0, 0); put(SI.legs, i * 2 + 1, .1, .42, 0, -sw, 0, 0);
  const sp = o.spearDown ? -1.2 : 0;
  put(SI.spear, i, .32, 1.5, .1, sp, 0, 0); put(SI.tip, i, .32, 1.5 + Math.cos(sp) * 1.35, .1 + Math.sin(-sp) * -1.35, sp, 0, 0);
  put(SI.shield, i, -.3, 1.15, .18, 1.57, 0, 0); SI.shield.setColorAt(i, _c.set(o.shield || col));
}
function soldierEnd() {
  for (const k in SI) { SI[k].count = k === 'legs' ? SN * 2 : SN; SI[k].instanceMatrix.needsUpdate = true; if (SI[k].instanceColor) SI[k].instanceColor.needsUpdate = true; }
}
// an army block: rows x cols, centred at c, facing yaw (0 = +z)
function block(c, yaw, rows, cols, col, phase0, march, o = {}) {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), dx = Math.sin(yaw), dz = Math.cos(yaw), r = rng(o.seed || 1);
  for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
    const ox = (b - (cols - 1) / 2) * 1.25 + (r() - .5) * .35, oz = (a - (rows - 1) / 2) * -1.35 + (r() - .5) * .35;
    const p = V3(c.x + fx * ox + dx * (oz + march), 0, c.z + fz * ox + dz * (oz + march));
    const fly = o.fly ? o.fly(a, b, r) : 0;
    soldier(p, yaw, phase0 + (a + b) * .35 + r() * .5, col, { run: o.run, fly, flyDir: o.flyDir, spin: .6 + r(), spinZ: (r() - .5), flyH: .6 + r(), shield: o.shield });
  }
}

// ── environment ──────────────────────────────────────────────────────────────
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: V3(0, .1, -1) }, sunCol: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top,hor,sunCol,sunDir; varying vec3 vW; void main(){ float h = clamp(vW.y,0.,1.); vec3 c = mix(hor, top, pow(h,.55)); float s = max(dot(normalize(vW), normalize(sunDir)),0.); c += sunCol*(pow(s,600.)*4.+pow(s,12.)*.45); gl_FragColor = vec4(c,1.); }'
}));
scene.add(sky);
const ground = mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: '#e8cca0' }), false);
ground.rotation.x = -1.5708; ground.position.set(0, 0, 600); scene.add(ground);
// mound for the ending
const mound = mesh(new THREE.SphereGeometry(9, 32, 16, 0, 6.2832, 0, Math.PI * .5), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: '#b8946a' }));
mound.scale.y = .16; mound.position.set(0, -.05, 600); scene.add(mound);
// far hills
const hills = new THREE.Group(); scene.add(hills);
{ const r = rng(12); for (let i = 0; i < 26; i++) { const h = 40 + r() * 90, cone = mesh(new THREE.ConeGeometry(80 + r() * 120, h, 7), M('#6e5a4a', { flatShading: true, roughness: 1 }), false);
  const a = r() * 6.28, d = 700 + r() * 500; cone.position.set(Math.cos(a) * d, h / 2 - 5, 600 + Math.sin(a) * d); hills.add(cone); } }
// palm trees
const palms = new THREE.Group(); scene.add(palms);
function palm(x, z, h, seed) {
  const g = new THREE.Group(), r = rng(seed); g.position.set(x, 0, z);
  const lean = (r() - .5) * .3;
  for (let i = 0; i < 8; i++) { const s = mesh(G.cyl(.2 - i * .012, .22 - i * .012, h / 8, 10), M('#6b5236', { roughness: 1 })); s.position.set(Math.sin(lean) * i * h / 8 * .6, h / 16 + i * h / 8, 0); g.add(s); }
  const top = V3(Math.sin(lean) * h * .6, h, 0);
  for (let i = 0; i < 9; i++) { const l = mesh(new THREE.PlaneGeometry(1.1, 3.4), new THREE.MeshStandardMaterial({ map: leafTex, transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .8 }));
    l.geometry.translate(0, 1.7, 0); l.position.copy(top); l.rotation.set(0, i / 9 * 6.28 + r(), 0); l.rotateX(1.1 + r() * .4); g.add(l); }
  palms.add(g);
}
{ const r = rng(33); for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = 60 + r() * 260; const x = Math.cos(a) * d, z = 600 + Math.sin(a) * d; if (Math.abs(x) < 40 && z > 520 && z < 720) continue; palm(x, z, 7 + r() * 5, 100 + i); } }

// palace hall (around the origin)
const palace = new THREE.Group(); scene.add(palace);
{ const floor = mesh(new THREE.PlaneGeometry(14, 34), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: .35, metalness: .1 }), false); floor.rotation.x = -1.5708; floor.position.z = 2; palace.add(floor);
  const carpet = mesh(new THREE.PlaneGeometry(2.4, 24), M('#8a1a14', { roughness: .95 }), false); carpet.rotation.x = -1.5708; carpet.position.set(0, .01, 4); palace.add(carpet);
  const cb = mesh(new THREE.PlaneGeometry(2.7, 24), M('#d9a632', { roughness: .6 }), false); cb.rotation.x = -1.5708; cb.position.set(0, .005, 4); palace.add(cb);
  for (let z = -6; z <= 16; z += 4) for (const x of [-4.2, 4.2]) {
    const col = mesh(G.cyl(.42, .5, 7, 16), M('#c2a080', { roughness: .6 })); col.position.set(x, 3.5, z); palace.add(col);
    const cap = mesh(G.box(1.3, .4, 1.3), M('#a8805a')); cap.position.set(x, 7.1, z); palace.add(cap);
    const ring = mesh(G.cyl(.52, .52, .25, 16), GOLD); ring.position.set(x, 1.2, z); palace.add(ring); }
  const wall = mesh(G.box(14, 9, .5), M('#8a6a50', { roughness: .9 })); wall.position.set(0, 4.5, -10); palace.add(wall);
  const arch = mesh(new THREE.TorusGeometry(2.6, .25, 10, 30, Math.PI), GOLD); arch.position.set(0, 3.2, -9.7); palace.add(arch);
  const archBg = mesh(new THREE.CircleGeometry(2.6, 30, 0, Math.PI), M('#4a1a10', { roughness: 1 })); archBg.position.set(0, 3.2, -9.72); palace.add(archBg);
  const archBg2 = mesh(G.box(5.2, 3.2, .05), M('#4a1a10', { roughness: 1 })); archBg2.position.set(0, 1.6, -9.72); palace.add(archBg2);
  [-1, 1].forEach(s => { const sideW = mesh(G.box(.5, 9, 34), M('#6a4430', { roughness: .9 })); sideW.position.set(s * 7, 4.5, 2); palace.add(sideW); });
  const ceil = mesh(G.box(14, .5, 34), M('#4a3020')); ceil.position.set(0, 9, 2); palace.add(ceil);
  // throne
  const th = new THREE.Group(); th.position.set(0, 0, -7.5); palace.add(th);
  const st = mesh(G.box(3.4, .35, 2.4), M('#7a5238')); st.position.y = .17; th.add(st);
  const seat = mesh(G.box(1.5, .5, 1.1), GOLD); seat.position.set(0, .6, 0); th.add(seat);
  const cush = mesh(G.box(1.3, .15, .95), M('#8a1a14', { roughness: .9 })); cush.position.set(0, .9, .02); th.add(cush);
  const backr = mesh(G.box(1.5, 2.2, .2), GOLD); backr.position.set(0, 1.9, -.5); th.add(backr);
  const bdisc = mesh(G.cyl(.7, .7, .1, 32), M('#8a1a14')); bdisc.rotation.x = 1.57; bdisc.position.set(0, 2.5, -.38); th.add(bdisc);
  [-1, 1].forEach(s => { const arm = mesh(G.box(.18, .5, 1.1), GOLD); arm.position.set(s * .76, 1.1, 0); th.add(arm); const lion = mesh(G.sph(.16), GOLD); lion.position.set(s * .76, 1.4, .5); th.add(lion); });
}
// torches
const torches = [];
function torch(x, y, z, parent, intensity = 18) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const bowl = mesh(G.cyl(.18, .08, .2, 12), GOLD); g.add(bowl);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.13, .5, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, .4) }));
  flame.position.y = .32; g.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(.07, .28, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4, 2) })); core.position.y = .24; g.add(core);
  const L = new THREE.PointLight('#ff9a40', intensity, 14, 1.6); L.position.y = .5; g.add(L);
  const T = { g, flame, L, base: intensity, seed: torches.length * 3.1 }; torches.push(T); return T;
}
for (let z = -6; z <= 14; z += 4) for (const x of [-3.6, 3.6]) torch(x, 2.6, z, palace, 9);
torch(-1.8, 1.2, -7.5, palace, 10); torch(1.8, 1.2, -7.5, palace, 10);
function flickerTorches(t) { for (const T of torches) { const f = .82 + noise(t * 9, T.seed) * .3 + Math.sin(t * 31 + T.seed) * .04; T.L.intensity = T.base * f; T.flame.scale.set(1, .85 + f * .3, 1); T.flame.rotation.z = (noise(t * 5, T.seed + 2) - .5) * .3; } }

// tent (war council) at x = 200
const tent = new THREE.Group(); tent.position.set(200, 0, 0); scene.add(tent);
{ const cone = mesh(new THREE.ConeGeometry(8, 7, 24, 1, true), M('#6a2a1a', { side: THREE.BackSide, roughness: 1 }), false); cone.position.y = 3.5; tent.add(cone);
  const cyl = mesh(G.cyl(8, 8, 3, 24, true), M('#7a3a22', { side: THREE.BackSide, roughness: 1 }), false); cyl.position.y = 1.5; tent.add(cyl);
  const stripes = mesh(G.cyl(7.95, 7.95, .3, 24, true), M('#d9a632', { side: THREE.BackSide }), false); stripes.position.y = 2.7; tent.add(stripes);
  const fl = mesh(new THREE.CircleGeometry(8, 24), M('#3a2416', { roughness: 1 }), false); fl.rotation.x = -1.5708; tent.add(fl);
  const table = mesh(G.box(2.8, .12, 1.7), WOOD); table.position.y = .95; tent.add(table);
  [[-1.2, -.7], [1.2, -.7], [-1.2, .7], [1.2, .7]].forEach(([x, z]) => { const l = mesh(G.box(.12, .95, .12), WOOD); l.position.set(x, .47, z); tent.add(l); });
  const map = mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ map: mapTex, roughness: .9 }), false); map.rotation.x = -1.5708; map.position.y = 1.015; tent.add(map);
  // a tiny figurine of the boy on the map
  const fig = mesh(G.cyl(.03, .05, .14, 8), GOLD); fig.position.set(.15, 1.09, .48); tent.add(fig);
  const pole = mesh(G.cyl(.08, .08, 7), WOOD); pole.position.set(0, 3.5, -3); tent.add(pole); }
torch(-1.6, 1.4, -1.6, tent, 12); torch(1.6, 1.4, -1.6, tent, 12); torch(2.6, 1.4, .8, tent, 8);

// city wall + gopuram gate (Pandya side, z = 700, facing -z)
const city = new THREE.Group(); city.position.set(0, 0, 712); scene.add(city);
{ const ochre = M('#c08a50', { roughness: .85 }), red = M('#9a3a22', { roughness: .85 });
  let w = 14, y = 0;
  for (let i = 0; i < 7; i++) { const h = i === 0 ? 9 : 3.2, tier = mesh(G.box(w, h, 8 - i * .5), i % 2 ? red : ochre); tier.position.y = y + h / 2; city.add(tier);
    if (i > 0) for (let k = -2; k <= 2; k++) { const win_ = mesh(G.box(.5, 1.1, .1), M('#2a1408')), x = k * (w / 6); if (Math.abs(x) < w / 2 - .4) { win_.position.set(x, y + h / 2, -(8 - i * .5) / 2 - .02); city.add(win_); } }
    y += h; w -= 1.6; }
  const roof = mesh(new THREE.CylinderGeometry(1.6, 1.6, w + 1.6, 16, 1, false, 0, Math.PI), red); roof.rotation.z = 1.5708; roof.position.y = y; city.add(roof);
  for (let k = -2; k <= 2; k++) { const kal = mesh(new THREE.ConeGeometry(.25, .9, 10), GOLD); kal.position.set(k * 1.0, y + 2, 0); city.add(kal); }
  const door = mesh(G.box(5, 7, .3), M('#0d0603', { roughness: 1 })); door.position.set(0, 3.5, -4.05); city.add(door);
  const doorArch = mesh(new THREE.TorusGeometry(2.5, .3, 8, 24, Math.PI), GOLD); doorArch.position.set(0, 7, -4.1); city.add(doorArch);
  [-1, 1].forEach(s => { const wall = mesh(G.box(80, 7, 3), ochre); wall.position.set(s * 47, 3.5, 0); city.add(wall);
    for (let x = 8; x < 87; x += 2.4) { const m_ = mesh(G.box(1.2, 1, 3), ochre); m_.position.set(s * x, 7.5, 0); city.add(m_); } }); }
const cityTorches = [torch(-3.4, 4, -4.3, city, 22), torch(3.4, 4, -4.3, city, 22)];

// dust
const DUSTN = 700;
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUSTN * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 1.3, transparent: true, opacity: .16, depthWrite: false, color: '#e8d0b0' }));
dust.frustumCulled = false; scene.add(dust);
const dustSeed = (() => { const r = rng(77); return Array.from({ length: DUSTN }, () => [r(), r(), r(), r()]); })();
function setDust(center, radius, height, t, amt = 1, wind = V3(1, 0, .3)) {
  dust.visible = amt > 0; dust.material.opacity = .14 * amt; const a = dustGeo.attributes.position.array;
  dustSeed.forEach(([u, v, w, s], i) => { const x = (u - .5) * radius * 2 + ((t * wind.x * (2 + s * 3)) % (radius * 2)), z = (v - .5) * radius * 2 + t * wind.z * 2;
    a[i * 3] = center.x + (((x + radius) % (radius * 2)) + radius * 2) % (radius * 2) - radius; a[i * 3 + 1] = .3 + w * height + Math.sin(t + s * 6) * .3; a[i * 3 + 2] = center.z + z; });
  dustGeo.attributes.position.needsUpdate = true;
}

// lights
const hemi = new THREE.HemisphereLight('#bcd0ff', '#5a4030', .6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd0a0', 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
scene.add(sun); scene.add(sun.target);
const key = new THREE.SpotLight('#ffe0b0', 0, 30, .5, .6, 1.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key); scene.add(key.target);
const fill = new THREE.PointLight('#ffb070', 0, 20, 2); scene.add(fill);
scene.fog = new THREE.Fog('#000', 10, 100);

const PRESET = {
  palace: { top: '#1a0d06', hor: '#2a160a', sun: '#000000', fog: ['#1a0e08', 8, 40], hemi: ['#ffd0a0', '#2a1408', .45], sunI: 0, exp: 1.15, tint: [1.0, .97, .93], sat: 1.0 },
  tent: { top: '#0a0503', hor: '#0a0503', sun: '#000', fog: ['#120804', 6, 30], hemi: ['#ffc090', '#1a0a04', .35], sunI: 0, exp: 1.25, tint: [1.02, .96, .9], sat: 1.0 },
  dusk: { top: '#2a3a6a', hor: '#ff9a5a', sun: '#ffb070', fog: ['#b88068', 60, 900], hemi: ['#ffd0b0', '#5a4030', 1.1], sunI: 2.8, sunCol: '#ffb070', sunDir: [-.6, .25, -1], exp: 1.05, tint: [1.0, .97, .95], sat: 1.05 },
  night: { top: '#03060f', hor: '#101a33', sun: '#4060a0', fog: ['#0a1020', 20, 160], hemi: ['#4060a0', '#0a0a10', .25], sunI: .5, sunCol: '#7090ff', sunDir: [.5, .6, -1], exp: 1.15, tint: [.9, .95, 1.1], sat: 1.05 },
  dawn: { top: '#5a8ac8', hor: '#ffd9a0', sun: '#fff0c0', fog: ['#d8c0a0', 80, 1000], hemi: ['#d0e0ff', '#6a5038', .8], sunI: 3.2, sunCol: '#ffe0b0', sunDir: [.8, .35, .4], exp: 1.0, tint: [1.02, 1, .96], sat: 1.12 },
  battle: { top: '#4a4a5a', hor: '#d0a070', sun: '#ffd0a0', fog: ['#b89070', 30, 500], hemi: ['#e0d0c0', '#5a4030', .8], sunI: 2.6, sunCol: '#ffd0a0', sunDir: [.5, .5, .6], exp: 1.0, tint: [1.04, .98, .92], sat: 1.05 },
  charge: { top: '#4a4a5a', hor: '#d0a070', sun: '#ffd0a0', fog: ['#b89070', 30, 500], hemi: ['#e0d0c0', '#5a4030', 1.0], sunI: 2.8, sunCol: '#ffd0a0', sunDir: [.4, .55, -.7], exp: 1.05, tint: [1.02, .98, .94], sat: 1.05 },
  sunset: { top: '#3a2a5a', hor: '#ffb050', sun: '#ffd080', fog: ['#e09060', 80, 1200], hemi: ['#ffd0a0', '#5a3020', 1.0], sunI: 3.2, sunCol: '#ffb060', sunDir: [0, .18, -1], exp: 1.05, tint: [1.03, .97, .92], sat: 1.1 },
};
function applyPreset(name, focus) {
  const p = PRESET[name];
  sky.material.uniforms.top.value.set(p.top); sky.material.uniforms.hor.value.set(p.hor); sky.material.uniforms.sunCol.value.set(p.sun);
  if (p.sunDir) sky.material.uniforms.sunDir.value.set(...p.sunDir);
  scene.fog.color.set(p.fog[0]); scene.fog.near = p.fog[1]; scene.fog.far = p.fog[2];
  hemi.color.set(p.hemi[0]); hemi.groundColor.set(p.hemi[1]); hemi.intensity = p.hemi[2];
  sun.intensity = p.sunI; if (p.sunCol) sun.color.set(p.sunCol);
  if (p.sunDir && focus) { const d = V3(...p.sunDir).normalize(); sun.position.copy(focus).addScaledVector(d, 60); sun.target.position.copy(focus);
    const cam = sun.shadow.camera; const R = focus.r || 25; cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 1; cam.far = 160; cam.updateProjectionMatrix(); }
  renderer.toneMappingExposure = p.exp; grade.uniforms.uTint.value.set(...p.tint); grade.uniforms.uSat.value = p.sat;
  const outdoor = !['palace', 'tent'].includes(name);
  sky.visible = outdoor; ground.visible = outdoor; hills.visible = outdoor; palms.visible = outdoor; city.visible = outdoor;
  palace.visible = name === 'palace'; tent.visible = name === 'tent';
}

// ── shots ────────────────────────────────────────────────────────────────────
const LINES = TM.lines;
const SHOTS = LINES.map((l, i) => ({ name: l.shot, a: i === 0 ? 0 : l.t0 - .08, b: i < LINES.length - 1 ? LINES[i + 1].t0 - .08 : TM.duration + .3, line: l }));
const wordT = (line, k) => { const ws = TM.words.filter(w => w.line === line); return ws[Math.min(k, ws.length - 1)].t0; };
const hideAll = () => {
  [BOY, CHERA, CHOLA, ...CHIEFS, ...COURT].forEach(p => p.root.visible = false); crowner.visible = false;
  banners.forEach(b => b.g.visible = false); key.intensity = 0; fill.intensity = 0; dust.visible = false;
  BOY.sword.visible = true; BOY.crown.visible = true; mound.visible = false;
};
const headPos = (P, off = V3(0, 0, 0)) => { P.root.updateMatrixWorld(true); return P.head.getWorldPosition(V3(0, 0, 0)).add(off); };
const place = (P, x, y, z, yaw = 0) => { P.root.visible = true; P.root.position.set(x, y, z); P.root.rotation.set(0, yaw, 0); };
const placeB = (B, x, z, yaw = 0, o = {}) => { B.g.visible = true; B.g.position.set(x, o.y || 0, z); B.g.rotation.set(o.rx || 0, yaw, o.rz || 0); B.g.scale.setScalar(o.s || 1); };
let shake = 0, flash = 0, fade = 0, ab = .0015;

const ENEMY_POS = [[-13, 0], [13, 0], [-26, -16], [0, -16], [26, -16], [-13, -32], [13, -32]];
const ENEMY_ROW = [0, 0, 1, 1, 1, 2, 2];
function enemyArmies(t, zBase, march, o = {}) {
  ENEMY_POS.forEach(([x, dz], i) => {
    const c = V3(x * (o.spread || 1), 0, zBase + dz);
    block(c, 0, o.rows || 7, o.cols || 9, ARMY_COL[i], t * 5.2, march, { seed: 50 + i, run: o.run, fly: o.fly ? (a, b, r) => o.fly(i, a, b, r) : null, flyDir: V3(0, 0, -1) });
    armyBanners[i].forEach((B, k) => { if (o.noBanners) return; placeB(B, c.x + (k - 1) * 4.2, c.z + march + 4.6, 0);
      if (o.bannerFall) { const f = o.bannerFall(i, k); if (f > 0) { B.g.rotation.x = -easeIn(f) * 1.45; B.g.position.y = 0; } } });
  });
}
function pandyaArmy(t, z0, march, o = {}) {
  [-14, 0, 14].forEach((x, i) => block(V3(x, 0, z0), Math.PI, o.rows || 8, o.cols || 9, '#c9952e', t * (o.run ? 9 : 5.2), march, { seed: 80 + i, run: o.run, shield: '#1d3f8a' }));
  pandyaBanners.forEach((B, k) => { if (o.noBanners) return; placeB(B, -16 + k * 8, z0 - march - 5.4, Math.PI); });
}

const SHOT = {
  hook_crown(lt, T, t) {
    applyPreset('palace');
    place(BOY, 0, 0, -7.4); pose(BOY, { ...sitPose, pitch: -.12 + win(lt, 1.2, 1.7) * .12, lookY: 1 - win(lt, 1.2, 1.7), raise: .6 * (1 - win(lt, 1.6, 2)), blink: false }, t);
    const h = headPos(BOY);
    BOY.crown.visible = lt > 1.62; crowner.visible = lt < 2.2;
    const k = easeOut(win(lt, 0, 1.6));
    crowner.position.set(h.x, h.y + .13 + lerp(.55, 0, k) + (lt > 1.62 ? easeIn((lt - 1.62) / .5) * .9 : 0), h.z);
    flyingCrown.visible = lt < 1.62; flyingCrown.position.set(0, 0, 0);
    key.intensity = 50; key.position.set(h.x + 1.2, h.y + 2.5, h.z + 2.5); key.target.position.copy(h);
    flash = Math.max(0, 1 - Math.abs(lt - 1.65) / .18) * .45;
    const e = ease(lt / T);
    return { pos: h.clone().add(V3(lerp(.4, .15, e), lerp(-.05, 0, e), lerp(1.9, 1.35, e))), look: h.clone().add(V3(0, .18, 0)), fov: 40 };
  },
  hook_armies(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(0, 0, 545), { r: 70 }));
    soldierBegin(); enemyArmies(t, 520, lt * 1.6); soldierEnd();
    setDust(V3(0, 0, 545), 60, 4, t, .8);
    const p = lerpV(V3(0, .45, 538), V3(0, 1.0, 543), ease(lt / T));
    shake = lt > T - .5 ? .2 : 0;
    return { pos: p, look: V3(0, 3.2, 520), fov: 56 };
  },
  throne(lt, T, t) {
    applyPreset('palace');
    place(BOY, 0, 0, -7.4); pose(BOY, { ...sitPose, pitch: .05 }, t);
    COURT.forEach((c, i) => { place(c, (i % 2 ? 1 : -1) * 2.2, 0, -3 + Math.floor(i / 2) * 3, (i % 2 ? -1 : 1) * 1.2); pose(c, { armR: { x: -.3, el: -1.2, z: .3 }, armL: { x: -.3, el: -1.2, z: .3 }, nod: .05 }, t + i); });
    placeB(BN.fish, -2.2, -8.6, 0, { s: 1 }); placeB(BN.fish2, 1.4, -8.6, 0, { s: 1 });
    const k = ease(lt / T);
    return { pos: V3(lerp(-2.6, -.6, k), lerp(5.2, 2.4, k), lerp(10, 1.0, k)), look: V3(0, 1.4, -7.4), fov: 44 };
  },
  throne_close(lt, T, t) {
    applyPreset('palace');
    place(BOY, 0, 0, -7.4); pose(BOY, { ...sitPose, legR: { x: -1.5, k: .7 + Math.sin(t * 5) * .15 }, legL: { x: -1.5, k: .7 - Math.sin(t * 5) * .15 }, worry: .8, lookX: -.6, yaw: .15 }, t);
    const h = headPos(BOY);
    key.intensity = 40; key.position.set(h.x - 1.5, h.y + 2.5, h.z + 3); key.target.position.copy(h);
    const k = ease(lt / T);
    return { pos: h.clone().add(V3(lerp(.9, .6, k), lerp(-.25, -.3, k), lerp(2.6, 2.1, k))), look: h.clone().add(V3(0, -.45, 0)), fov: 40 };
  },
  tent_laugh(lt, T, t) {
    applyPreset('tent');
    const l1 = Math.sin(t * 14), l2 = Math.sin(t * 13 + 1);
    place(CHERA, 199.45, 0, -1.25, .3); pose(CHERA, { lean: -.18 + l1 * .05, pitch: -.35 + l1 * .06, mouth: .8 + l1 * .2, squint: .7, armL: { x: -.2, z: .5, el: -1.6 }, armR: { x: -.6, el: -.4 } }, t);
    place(CHOLA, 200.55, 0, -1.25, -.3); pose(CHOLA, { lean: -.22 + l2 * .05, pitch: -.4 + l2 * .06, mouth: .9 + l2 * .2, squint: .7, armL: { x: -.9, z: .2, el: -.9 }, armR: { x: -.4, el: -.6 } }, t);
    const h = headPos(CHERA).add(headPos(CHOLA)).multiplyScalar(.5);
    fill.intensity = 18; fill.position.set(200, 2.8, 1.5);
    const a = lerp(-.18, .18, ease(lt / T));
    return { pos: V3(200 + Math.sin(a) * 4.4, h.y + .2, -1.25 + Math.cos(a) * 4.4), look: h.clone().add(V3(0, -.55, 0)), fov: 44 };
  },
  chera(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(-20, 0, 540), { r: 30 }));
    place(CHERA, -20, 0, 541); pose(CHERA, { pitch: .06, angry: .4, armL: { x: -1.3, z: .1, el: -.4 }, armR: { x: -.3, el: -.8 }, mouth: .05 }, t);
    placeB(BN.chera, -20 - 1.6, 539.2, 0, { s: 1 });
    soldierBegin(); block(V3(-20, 0, 528), 0, 6, 9, ARMY_COL[0], t * 5, 0, { seed: 50 }); soldierEnd();
    setDust(V3(-20, 0, 540), 30, 3, t, .6);
    const h = headPos(CHERA);
    key.intensity = 90; key.color.set('#ffd8b0'); key.position.copy(h).add(V3(1.6, 1.2, 3.2)); key.target.position.copy(h);
    const k = easeOut(lt / T * 1.3);
    return { pos: h.clone().add(V3(lerp(-.4 * 2.5, -.4, k), lerp(-.45, -.25, k), lerp(3.4, 2.2, k))), look: h.clone().add(V3(0, -.2, 0)), fov: 40 };
  },
  chola(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(20, 0, 540), { r: 30 }));
    place(CHOLA, 20, 0, 541); pose(CHOLA, { pitch: .1, angry: .6, armL: { x: -.8, z: .2, el: -1.8 }, armR: { x: -.9, z: -.3, el: -1.7 }, mouth: .05 }, t);
    placeB(BN.chola, 20 - 1.6, 539.2, 0, { s: 1 });
    soldierBegin(); block(V3(20, 0, 528), 0, 6, 9, ARMY_COL[1], t * 5, 0, { seed: 51 }); soldierEnd();
    setDust(V3(20, 0, 540), 30, 3, t, .6);
    const h = headPos(CHOLA);
    key.intensity = 90; key.color.set('#ffd8b0'); key.position.copy(h).add(V3(1.6, 1.2, 3.2)); key.target.position.copy(h);
    const k = easeOut(lt / T * 1.3);
    return { pos: h.clone().add(V3(lerp(.4 * 2.5, .4, k), lerp(-.45, -.25, k), lerp(3.4, 2.2, k))), look: h.clone().add(V3(0, -.2, 0)), fov: 40 };
  },
  chiefs(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(0, 0, 545), { r: 30 }));
    const ws = [0, 1, 2].map(k => wordT(7, k) - SHOTS[7].a);
    CHIEFS.forEach((c, i) => {
      const at = lerp(ws[0] - .1, ws[2] + .1, i / 4), k = back(win(lt, at, at + .25));
      place(c, -6 + i * 3, 0, 545); c.root.scale.setScalar(Math.max(.001, k)); pose(c, { angry: .5, armR: { x: -.2, el: -.3 }, armL: { x: -.2, el: -.3 }, pitch: .05 }, t + i);
      placeB(BN.chiefs[i], -6 + i * 3 - .9, 543.8, 0, { s: Math.max(.001, k) });
    });
    soldierBegin(); enemyArmies(t, 525, 0, { rows: 5, cols: 8, noBanners: true }); soldierEnd();
    const k = ease(lt / T);
    fill.intensity = 60; fill.position.set(0, 3.5, 550); fill.distance = 25;
    return { pos: V3(lerp(-2, 2, k), 1.5, 551.5), look: V3(lerp(-1.5, 1.5, k), 1.85, 545), fov: 52 };
  },
  armies_wide(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(0, 0, 530), { r: 90 }));
    soldierBegin(); enemyArmies(t, 515, lt * 1.6); soldierEnd();
    setDust(V3(0, 0, 530), 80, 6, t, 1);
    const k = ease(lt / T);
    return { pos: V3(lerp(-6, 5, k), lerp(13, 10, k), lerp(546, 542, k)), look: V3(0, 1, 500), fov: 55 };
  },
  lone_boy(lt, T, t) {
    applyPreset('dusk', Object.assign(V3(0, 0, 600), { r: 60 }));
    place(BOY, 0, 0, 640, Math.PI); pose(BOY, { armR: { x: .05, z: .15, el: -.1, hx: 1.4 }, angry: .2 }, t);
    soldierBegin(); enemyArmies(t, 560, 0, { spread: .7 }); soldierEnd();
    setDust(V3(0, 0, 610), 60, 3, t, .9, V3(2.5, 0, -.6));
    const k = ease(lt / T);
    return { pos: V3(lerp(1.5, .6, k), lerp(1.0, 1.4, k), lerp(646, 652, k)), look: V3(0, 2.2, 600), fov: 46 };
  },
  vow(lt, T, t) {
    applyPreset('night', Object.assign(V3(0, 0, 700), { r: 20 }));
    place(BOY, 0, 0, 704, Math.PI); pose(BOY, { angry: .9 * win(lt, .2, .8), pitch: .05, lookY: -.2, armR: { x: .05, z: .15, el: -.1, hx: 1.4 }, blink: false }, t);
    cityTorches.forEach(T_ => T_.base = 30);
    const h = headPos(BOY);
    key.intensity = 45; key.color.set('#ff9a50'); key.position.copy(h).add(V3(1.4, .8, -2.2)); key.target.position.copy(h);
    const k = ease(lt / T);
    return { pos: h.clone().add(V3(lerp(.25, .1, k), lerp(-.05, 0, k), -lerp(1.5, 1.0, k))), look: h.clone().add(V3(0, .08, 0)), fov: 34 };
  },
  vow_sword(lt, T, t) {
    applyPreset('night', Object.assign(V3(0, 0, 700), { r: 20 }));
    const up = ease(win(lt, .35, 1.05));
    place(BOY, 0, 0, 704, Math.PI);
    pose(BOY, { angry: 1, pitch: lerp(.05, -.25, up), armR: { x: lerp(.05, -2.9, up), z: lerp(.15, .25, up), el: lerp(-.1, -.15, up), hx: lerp(1.4, 0, up) }, armL: { x: -.2, z: .3, el: -.4 }, lean: -.05 * up, blink: false, mouth: lt > 1.5 && lt < 2.6 ? .5 : 0 }, t);
    key.intensity = 35; key.color.set('#ff9a50'); key.position.set(1.5, 2.5, 701.5); key.target.position.set(0, 1.6, 704);
    const crushAt = wordT(11, 3) - SHOTS[11].a;
    flash = Math.max(0, 1 - Math.abs(lt - crushAt) / .12) * .7 + Math.max(0, 1 - Math.abs(lt - crushAt - .25) / .08) * .4;
    if (Math.abs(lt - crushAt) < .3) { hemi.intensity = 2.5; hemi.color.set('#c0d0ff'); }
    shake = lt > crushAt && lt < crushAt + .4 ? .25 : 0;
    const k = ease(lt / T);
    return { pos: V3(lerp(.7, .5, k), lerp(.5, .45, k), lerp(701.2, 700.7, k)), look: V3(0, 1.9, 704), fov: 46 };
  },
  gate(lt, T, t) {
    applyPreset('dawn', Object.assign(V3(0, 0, 690), { r: 40 }));
    soldierBegin(); pandyaArmy(t, 712, 8 + lt * 3.2, { rows: 8, cols: 9 }); soldierEnd();
    place(BOY, 0, 0, 712 - 8 - lt * 3.2 - 3, Math.PI); pose(BOY, { ...walk(t * 5.2), armR: { ...walk(t * 5.2).armR, hx: 1.4 }, angry: .6 }, t);
    setDust(V3(0, 0, 698), 30, 3, t, .7);
    const k = ease(lt / T);
    return { pos: V3(lerp(25, 22, k), .7, lerp(686, 684, k)), look: V3(2, 4, 702), fov: 50 };
  },
  march(lt, T, t) {
    applyPreset('dawn', Object.assign(V3(0, 0, 665), { r: 70 }));
    const m = 30 + lt * 3.2;
    soldierBegin(); pandyaArmy(t, 712, m, { rows: 8, cols: 9 }); soldierEnd();
    place(BOY, 0, 0, 712 - m - 3, Math.PI); pose(BOY, { ...walk(t * 5.2), armR: { ...walk(t * 5.2).armR, hx: 1.4 } }, t);
    setDust(V3(0, 0, 680), 50, 4, t, 1);
    const k = ease(lt / T);
    return { pos: V3(lerp(-40, -26, k), lerp(26, 18, k), lerp(690, 672, k)), look: V3(0, 0, 712 - m + 6), fov: 46 };
  },
  charge(lt, T, t) {
    applyPreset('charge', Object.assign(V3(0, 0, 630), { r: 40 }));
    const bz = 636 - lt * 7, ph = t * 9;
    soldierBegin(); pandyaArmy(t, 712, 712 - bz - 8, { rows: 8, cols: 9, run: 1, noBanners: true }); soldierEnd();
    place(BOY, 0, 0, bz, Math.PI); pose(BOY, { ...walk(ph, 1, 1), armR: { x: -1.3, z: .3, el: -.6, hx: .3 }, angry: 1, mouth: .7, blink: false }, t);
    setDust(V3(0, 0, bz), 25, 3, t, 1, V3(.3, 0, 3));
    const h = headPos(BOY);
    return { pos: V3(h.x - .7, h.y - .45, h.z - lerp(2.8, 2.2, lt / T)), look: h.clone().add(V3(0, -.3, 0)), fov: 48 };
  },
  battle(lt, T, t) {
    applyPreset('battle', Object.assign(V3(0, 0, 600), { r: 45 }));
    const hitT = (i) => .15 + i * .35;
    soldierBegin();
    enemyArmies(t, 588, lt * .5, { rows: 6, cols: 9, fly: (i, a, b, r) => { const at = hitT(ENEMY_ROW[i]) + a * .05 + r() * .15; return lt > at ? (lt - at) * 1.4 : 0; },
      bannerFall: (i) => win(lt, hitT(ENEMY_ROW[i]) + .1, hitT(ENEMY_ROW[i]) + .7) });
    pandyaArmy(t, 650, 44 + lt * 4, { rows: 6, cols: 9, run: 1, noBanners: true });
    soldierEnd();
    place(BOY, 0, 0, 603 - lt * 3, Math.PI); pose(BOY, { ...walk(t * 9, 1, 1), armR: { x: -2.6 + Math.max(0, Math.sin(lt * 9)) * 2.2, z: .3, el: -.3, hx: 0 }, angry: 1, mouth: .6, blink: false }, t);
    setDust(V3(0, 0, 595), 40, 6, t, 1.4, V3(1, 0, -2));
    shake = .35 * (1 - win(lt, 1.6, 2.3)); ab = .004;
    flash = Math.max(0, 1 - lt / .15) * .35;
    const k = ease(lt / T);
    return { pos: V3(lerp(9, 6, k), lerp(3.5, 6, k), lerp(612, 606, k)), look: V3(0, 1.2, 594), fov: 50 };
  },
  ending(lt, T, t) {
    applyPreset('sunset', Object.assign(V3(0, 0, 600), { r: 30 }));
    mound.visible = true;
    place(BOY, 0, 1.4, 600, Math.PI); pose(BOY, { armR: { x: .05, z: .2, el: -.1, hx: 1.4 }, armL: { x: -1.1, z: .25, el: -.7 }, pitch: -.08 }, t);
    placeB(BN.fish, -.55, 600.2, Math.PI, { y: 1.4, s: 1.25 });
    fallen.forEach((B, i) => placeB(B, -7 + i * 4.5, 604 + (i % 2) * 4, i * 1.3, { rx: 1.35, rz: (i % 2 ? .3 : -.2) }));
    setDust(V3(0, 0, 600), 30, 3, t, .5);
    const a = lerp(.5, -.25, ease(lt / T)), r = lerp(5, 16, easeIn(lt / T) * .6 + ease(lt / T) * .4);
    fade = win(lt, T - 1.0, T - .2);
    return { pos: V3(Math.sin(a) * r, lerp(2.0, 6.5, ease(lt / T)), 600 - Math.cos(a) * r), look: V3(0, lerp(2.6, 2.2, lt / T), 600), fov: 42 };
  },
};

// ── captions & overlays (2D canvas on top) ───────────────────────────────────
const ui = document.getElementById('ui'), U = ui.getContext('2d');
const CHUNKS = [];
{ let cur = null;
  TM.words.forEach((w, i) => {
    const next = TM.words[i + 1];
    if (!cur || cur.line !== w.line || cur.words.length >= 3 || (cur.words.map(x => x.w).join(' ') + ' ' + w.w).length > 16) { cur = { line: w.line, words: [] }; CHUNKS.push(cur); }
    cur.words.push(w);
  });
  CHUNKS.forEach((c, i) => { c.t0 = c.words[0].t0 - .03; const n = CHUNKS[i + 1]; const lineEnd = TM.lines[c.line].v1 + .25; c.t1 = n && n.line === c.line ? n.words[0].t0 - .03 : Math.min(lineEnd, n ? n.words[0].t0 - .05 : 1e9); });
}
function captions(t) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const k = (t - c.t0) / .12, pop = k < 1 ? .8 + .2 * back(k) : 1;
  U.save(); U.translate(W / 2, 1240); U.scale(pop, pop);
  U.font = '900 88px "Liberation Sans","DejaVu Sans",Arial,sans-serif'; U.textBaseline = 'middle'; U.lineJoin = 'round';
  const parts = c.words.map(w => ({ ...w, txt: w.w.toUpperCase() })), sp = 24;
  const widths = parts.map(p => U.measureText(p.txt).width), total = widths.reduce((a, b) => a + b, 0) + sp * (parts.length - 1);
  let x = -total / 2;
  parts.forEach((p, i) => {
    const active = t >= p.t0 - .03, col = p.hl ? '#ffd23a' : '#ffffff';
    U.globalAlpha = active ? 1 : .0;
    U.lineWidth = 16; U.strokeStyle = '#000'; U.strokeText(p.txt, x, 0);
    U.shadowColor = 'rgba(0,0,0,.6)'; U.shadowBlur = 18; U.shadowOffsetY = 6; U.fillStyle = col; U.fillText(p.txt, x, 0); U.shadowBlur = 0; U.shadowOffsetY = 0;
    x += widths[i] + sp;
  });
  U.restore();
}
function locationStamp(t) {
  const s = SHOTS.find(s => s.name === 'march'); const lt = t - (s.a + .5); if (lt < 0 || t > s.b) return;
  const a = clamp(lt / .25) * clamp((s.b - t) / .2);
  U.save(); U.globalAlpha = a; U.translate(W / 2, 400 - (1 - easeOut(lt / .35)) * 40);
  U.font = '900 84px "Liberation Sans",Arial,sans-serif'; U.textAlign = 'center'; U.textBaseline = 'middle'; U.lineJoin = 'round';
  const name = 'THALAIYALANGANAM', shown = name.slice(0, Math.floor(clamp(lt / .6) * name.length));
  // pin
  U.fillStyle = '#e8352a'; U.strokeStyle = '#000'; U.lineWidth = 8;
  U.beginPath(); U.arc(0, -110, 34, Math.PI * .85, Math.PI * .15); U.lineTo(0, -48); U.closePath(); U.stroke(); U.fill();
  U.fillStyle = '#fff'; U.beginPath(); U.arc(0, -112, 12, 0, 6.28); U.fill();
  U.lineWidth = 14; U.strokeStyle = '#000'; U.strokeText(shown, 0, 0); U.fillStyle = '#fff'; U.fillText(shown, 0, 0);
  U.font = '700 50px "Liberation Sans",Arial,sans-serif'; U.globalAlpha = a * clamp((lt - .6) / .3);
  U.lineWidth = 10; U.strokeText('Tiruvarur district, Tamil Nadu', 0, 76); U.fillStyle = '#ffd23a'; U.fillText('Tiruvarur district, Tamil Nadu', 0, 76);
  U.restore();
}

// ── frame ────────────────────────────────────────────────────────────────────
function drawFrame(t) {
  const s = SHOTS.find(s => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];
  const lt = t - s.a, T = s.b - s.a;
  hideAll(); shake = 0; flash = 0; fade = 0; ab = .0015;
  cityTorches.forEach(T_ => T_.base = 22); key.color.set('#ffe0b0');
  soldierBegin(); soldierEnd();
  const cam = SHOT[s.name](lt, T, t);
  // punch-in at the start of each cut (Shorts editing)
  const punch = 1 + .06 * (1 - easeOut(lt / .35));
  camera.fov = cam.fov / punch;
  const sh = shake + .03;
  const jit = V3((noise(t * 7, 1) - .5) * sh, (noise(t * 7, 2) - .5) * sh, 0);
  camera.position.copy(cam.pos).add(V3((noise(t * .8, 5) - .5) * .05, (noise(t * .8, 6) - .5) * .05, 0));
  camera.lookAt(cam.look.clone().add(jit.multiplyScalar(1.5)));
  camera.rotateZ((noise(t * .5, 9) - .5) * .02 + (shake ? (noise(t * 9, 4) - .5) * shake * .15 : 0));
  camera.updateProjectionMatrix();
  waveBanners(t); flickerTorches(t);
  grade.uniforms.uTime.value = t; grade.uniforms.uFlash.value = flash; grade.uniforms.uFade.value = Math.max(fade, 1 - clamp(t / .15)); grade.uniforms.uAb.value = ab;
  composer.render();
  U.clearRect(0, 0, W, H);
  captions(t); locationStamp(t);
}
window.drawFrame = drawFrame;
window.SHOTS = SHOTS;
drawFrame(0.5);
window.ready = true;
