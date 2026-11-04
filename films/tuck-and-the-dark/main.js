// Entry: ?test=model draws the model sheet; otherwise the film
import { makeComp } from './gl.js';
import { BOIL } from './crayon.js';
const Q = new URLSearchParams(location.search);
const cv = document.getElementById('gl'); cv.width = innerWidth; cv.height = innerHeight;
const comp = makeComp(cv);
await Promise.all(['400 40px "Patrick Hand"', '700 40px Gaegu'].map(f => document.fonts.load(f)));
const M = await import('./film.js');
window.DUR = M.DUR; window.EV = M.EV; window.SUBS = M.SUBS;
if (Q.get('art')) { const A = await import('./art.js'); window.render = t => { BOIL.step = 0; A[Q.get('art')](comp, t); }; }
else if (Q.get('test') === 'model') window.render = t => { BOIL.step = Math.floor(t * 12); M.sheet(comp, t); };
else window.render = t => { BOIL.step = Math.floor(t * 12 + 1e-6); M.frame(comp, t); };
window.READY = true;
