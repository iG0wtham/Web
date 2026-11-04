# Score + foley + narration → out/mix.wav, for "Tuck and the Dark".
# Usage (from anywhere): LIB=<library> $LIB/.venv/bin/python mix.py
# Foley helpers and the voice chain follow the Lemo-Opuscar crayon-book demo's mix (crayon stick-slip, wet brush, crickets,
# compress → EQ → de-ess → warm near-field reverb). The score is this film's own: 84 bpm, G major, a lullaby theme.
import sys, os, json, numpy as np, soundfile as sf, soxr
from scipy.ndimage import uniform_filter1d
from scipy.signal import fftconvolve, sosfilt as _sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../..'))
sys.path.insert(0, LIB); sys.path.insert(0, os.path.join(LIB, 'core/audio'))
from sfx import *
from core.audio import sampler as S, pluck as PL

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']; N = int(DUR * SR)
rng = np.random.default_rng(21); S.seed(7)
def nz(d): return rng.standard_normal(int(round(d * SR)))
def T(d): return np.arange(int(round(d * SR))) / SR
def fade(x, a=.01, b=.03):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x
def envelope(d, pts): t = np.linspace(0, 1, int(round(d * SR))); return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])

# ── foley ────────────────────────────────────────────────────────────────────
def crayon(d, speed=1.0, v=1.0):
    n = nz(d); rate = int(SR / (70 + 90 * speed))
    grain = uniform_filter1d((rng.random(len(n) // rate + 2) ** 3).repeat(rate)[:len(n)], rate // 3 + 1)
    x = bp(n, 1400 + 600 * speed, 6500, 2) * (0.35 + grain * 1.6) + bp(n, 300, 900, 1) * 0.15
    return fade(x * envelope(d, [(0, 0), (.08, 1), (.85, .9), (1, 0)]) * v * 0.22, .01, .04)
def scribble(d, rate=6.5, v=1.0):
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - 0.08:
        L = 1 / rate * (0.8 + 0.4 * rng.random()); s = crayon(min(L, d - t), 1.3, v * (0.7 + 0.3 * rng.random()))
        i = int(t * SR); out[i:i + len(s)] += s[:len(out) - i]; t += L
    return out
def brush(d, v=1.0):
    n = nz(d); wet = lp(n, 1800) * 0.5 + bp(n, 1800, 5000) * 0.18
    grain = uniform_filter1d(np.abs(rng.standard_normal(len(n))), 400) * 0.6 + 0.7
    return fade(wet * grain * envelope(d, [(0, 0), (.06, .9), (.3, 1), (.8, .85), (1, 0)]) * 0.22 * v, .03, .1)
def cricket(d=1.2, v=1.0):
    out = np.zeros(int(d * SR)); t = 0
    while t < d - 0.1:
        for k in range(3):
            tc = T(0.018); c = np.sin(2 * np.pi * 4700 * tc) * np.sin(np.pi * tc / 0.018)
            i = int((t + k * 0.026) * SR); out[i:i + len(c)] += c[:len(out) - i]
        t += 0.32 + 0.1 * rng.random()
    return out * 0.05 * v
def soft_step(v=1.0):
    t = T(0.12); return fade(lp(nz(0.12), 700) * np.exp(-t / 0.02) * 0.35 * v + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.025) * 0.15 * v)
def splash(v=1.0):
    t = T(0.6); x = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 1.5 * np.exp(-t / 0.02))) / SR) * np.exp(-t / dd) for f, dd in [(700, .05), (1100, .04), (1600, .03)])
    return fade(x * 0.08 * v + bp(nz(0.6), 1500, 7000) * np.exp(-t / 0.12) * 0.12 * v)
def swish(d=0.4, v=1.0):
    n = nz(d); return lp(bp(n, 250, 2500), 2200) * np.sin(np.linspace(0, np.pi, len(n))) ** 2 * 0.3 * v
def thunk(v=1.0):   # Tuck pulling into his shell: a soft wooden knock
    t = T(0.25); return fade((np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.04) + bp(nz(0.25), 400, 1800) * np.exp(-t / 0.015) * 0.6) * 0.3 * v)
def breath(v=1.0):
    n = nz(0.7); return fade(bp(n, 500, 2500) * envelope(0.7, [(0, 0), (.4, 1), (1, 0)]) * 0.06 * v, .05, .1)
def flutter(d=1.2, v=1.0):
    n = nz(d); am = 0.5 + 0.5 * np.sin(2 * np.pi * 28 * T(d)); return fade(bp(n, 800, 3500) * am * envelope(d, [(0, 0), (.2, 1), (.8, 1), (1, 0)]) * 0.07 * v)
def croak(v=1.0):
    d = 0.35; t = T(d); f = 140 * (1 - 0.15 * t / d); ph = 2 * np.pi * np.cumsum(f) / SR; saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    return fade(bp(saw, 300, 1200) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 30 * t))) * 0.08 * v, .02, .06)
def room(d, v=1.0): return lp(nz(d), 400) * 0.012 * v

fol = np.zeros((N, 2)); amb = np.zeros((N, 2))
def put(x, at, g=1.0, pan=0.0, b=None): add(fol if b is None else b, np.asarray(x, dtype=np.float64), at, g, pan)
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'room': put(room(DUR), 0, 1, 0, amb)
    elif ty == 'scratch': put(crayon(e['dur'], 1.0), t, 0.5, e.get('pan', 0))
    elif ty == 'scribble': put(scribble(e['dur']), t, 0.45, e.get('pan', 0))
    elif ty == 'step': put(soft_step(), t, 0.7, e.get('pan', 0))
    elif ty == 'splash': put(splash(), t, 0.9, 0.2)
    elif ty == 'slide': put(swish(e['dur'], 0.6), t, 1, 0.3)
    elif ty == 'crickets': put(cricket(e['dur']), t, 0.9, -0.5, amb); put(cricket(e['dur']), t + 0.13, 0.7, 0.5, amb)
    elif ty == 'brush': put(brush(e['dur']), t, 1.1, 0)
    elif ty == 'hide': put(thunk(), t, 1, 0)
    elif ty == 'breath': put(breath(), t, 1, 0)
    elif ty == 'tap': put(S.hit('woodblock', 'a', .55), t, 0.8, 0.2)
    elif ty == 'flutter': put(flutter(e['dur']), t, 1, 0.3)
    elif ty == 'peek': put(swish(0.3, 0.5), t, 1, 0.1)
    elif ty == 'swish': put(crayon(e['dur'], 1.4, 0.8), t, 0.7, 0.2)
    elif ty == 'croak': put(croak(), t, 1, 0.4)
    elif ty == 'curl': put(swish(0.6, 0.6), t, 1, 0)
# crickets fade in before the dark and away near the end
cr_env = np.interp(np.arange(N) / SR, [0, 16.5, 19, 24, 31, 50, 57, 60], [0, 0, 0.6, 1, 0.7, 0.8, 0.5, 0])
amb[:, 0] *= np.maximum(cr_env, 0.15); amb[:, 1] *= np.maximum(cr_env, 0.15)

# ── score: 84 bpm, G major lullaby ────────────────────────────────────────────
BEAT = 60 / 84; BAR = 4 * BEAT
ev = []; rnd = np.random.default_rng(5)
def at(bar, beat=0): return bar * BAR + beat * BEAT
CH = {'G': ['G3', 'D4', 'G4', 'B4'], 'Em': ['E3', 'B3', 'E4', 'G4'], 'C': ['C4', 'G4', 'C5', 'E5'], 'D': ['D4', 'A4', 'D5', 'F#5'], 'Am': ['A3', 'E4', 'A4', 'C5']}
uke = []   # (t, pitch, vel, pan) for the modelled nylon string ("ukulele" lilt)
def lilt(bar, chord, vel=.5, sparse=False):
    p = CH[chord]
    pattern = [0, 2, 1, 3, 2, 3, 1, 2] if not sparse else [0, None, 2, None, None, None, 1, None]
    for k, idx in enumerate(pattern):
        if idx is None: continue
        uke.append((at(bar, k * 0.5), p[idx], vel * (1 if k % 2 == 0 else .8), -0.25 + 0.15 * (idx % 2)))
# day (bars 1–6): ukulele from the pull-out, shaker on the off-beats, recorder phrase
for b, c in zip(range(1, 6), ['G', 'Em', 'C', 'D', 'G']): lilt(b, c, .5)
for b in range(2, 6):
    for k in range(4): ev.append((at(b, k + .5), 'shaker', 'down' if k % 2 else 'up', None, .35, .35))
THEME = [('B4', 0, 1), ('D5', 1, 1), ('G5', 2, 2), ('E5', 4, 1), ('D5', 5, 1), ('B4', 6, 2), ('C5', 8, 1), ('A4', 9, 1), ('B4', 10, 1), ('G4', 11, 1), ('A4', 12, 3)]
def theme(bar0, vel=.5, upto=99, dur_scale=1.0):
    for p, bt, d in THEME[:upto]: ev.append(dict(t=at(bar0, bt), inst='recorder', pitch=p, dur=d * BEAT * .95 * dur_scale, vel=vel, pan=.15, attack=.03))
theme(2, .42, upto=6)                              # first half only (bars 3–4): the full theme is held back
# dark arriving (bars 6–8): single notes, thinning; then near silence
lilt(6, 'Em', .38, sparse=True); lilt(7, 'C', .3, sparse=True)
ev.append(dict(t=at(6), inst='recorder', pitch='E4', dur=BAR * 1.6, vel=.25, pan=-.2, attack=.4))
# bars 9–10: near silence; bar 10 (28.57–31.4): silence except the narrator
# the turn (bars 11–14): one note for Firefly's glow; the lilt comes back slowly
ev.append(dict(t=33.3, inst='glockenspiel', pitch='G6', dur=2.5, vel=.4, pan=.3))
lilt(12, 'G', .3, sparse=True); lilt(13, 'Em', .34, sparse=True); lilt(14, 'C', .38, sparse=True)
# the walk of lights (bars 15–18): the full theme, ukulele, shaker; a note per light
for b, c in zip(range(15, 19), ['G', 'Em', 'C', 'D']): lilt(b, c, .52)
for b in range(15, 19):
    for k in range(4): ev.append((at(b, k + .5), 'shaker', 'down' if k % 2 else 'up', None, .3, .35))
theme(15, .5)
for i, (e, p) in enumerate(zip([x for x in EV if x['type'] == 'light'], ['G5', 'A5', 'B5', 'D6', 'E6'])):
    ev.append(dict(t=e['t'], inst='glockenspiel', pitch=p, dur=2.0, vel=.5, pan=-.3 + .15 * i))
for e in [x for x in EV if x['type'] == 'sparkle']:
    ev.append(dict(t=e['t'], inst='glockenspiel', pitch=['D7', 'B6', 'G6', 'E7', 'A6'][e['i'] % 5], dur=1.5, vel=.18, pan=float(rnd.uniform(-.6, .6))))
# goodnight (bars 19–21): the recorder alone, the last note rings over the end
lilt(19, 'G', .3, sparse=True)
for p, bt, d in [('B4', 0, 1), ('A4', 1, 1), ('G4', 2, 6)]: ev.append(dict(t=at(19, bt + 1.5), inst='recorder', pitch=p, dur=d * BEAT, vel=.38, pan=.1, attack=.05))

mus = S.render(ev, dur=DUR, master=False).astype(np.float64)
uk = np.zeros((N, 2))
for (t, p, v, pan) in uke:
    x = PL.pluck('nylon_guitar', S.midi(p) + 12, 1.6, vel=v)
    add(uk, x.astype(np.float64), t, 0.55, pan)
mus = mus + uk
mus = S.room(mus.astype(np.float32), size=.35, mix=.2).astype(np.float64)
for c in range(2): mus[:, c] += bp(mus[:, c], 3000, 7000, 2) * 0.25           # a little sparkle on the glock

# ── narration: compress → EQ → de-ess → level → warm near-field reverb ───────
def biquad(x, kind, f0, gain_db, q=0.707):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; cw, sw = np.cos(w), np.sin(w); al = sw / (2 * q)
    if kind == 'peak': b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    else:
        s2 = 2 * np.sqrt(A) * al; sg = 1 if kind == 'high' else -1
        b = [A * ((A + 1) + sg * (A - 1) * cw + s2), -2 * sg * A * ((A - 1) + sg * (A + 1) * cw), A * ((A + 1) + sg * (A - 1) * cw - s2)]
        a = [(A + 1) - sg * (A - 1) * cw + s2, 2 * sg * ((A - 1) - sg * (A + 1) * cw), (A + 1) - sg * (A - 1) * cw - s2]
    return _sosfilt(np.array([b + a]) / a[0], x)
def deess(x, lo=4800, hi=10000, thr_rel=0.5, ratio=4.0):
    band = bp(x, lo, hi, 2); eb = uniform_filter1d(np.abs(band), int(0.004 * SR)); ef = uniform_filter1d(np.abs(x), int(0.004 * SR))
    over = eb / (ef * thr_rel + 1e-9); g = uniform_filter1d(np.where(over > 1, over ** (1 / ratio - 1), 1.0), int(0.003 * SR))
    return x - band + band * g
VO_RMS = 10 ** (-20.0 / 20)
vo = np.zeros((N, 2)); vmask = np.zeros(N)
for e in [x for x in EV if x['type'] == 'voice']:
    a, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
    if a.ndim > 1: a = a.mean(1)
    a = hp(soxr.resample(a, sr, SR), 75)
    a = compress(a / (np.abs(a).max() + 1e-9) * 0.8, thr=.2, ratio=2.5, att=.008, rel=.14)
    a = biquad(biquad(biquad(a, 'low', 220, 1.5), 'peak', 3200, -2.0, 1.0), 'high', 6000, -4.0)
    a = deess(a); act = np.abs(a) > np.abs(a).max() * 0.05
    a = a * VO_RMS / (np.sqrt(np.mean(a[act] ** 2)) + 1e-9)
    add(vo, a, e['t'], 1.0, 0.0); s = int(e['t'] * SR); vmask[s:s + len(a)] = 1
def warm_ir(seed):
    r = np.random.default_rng(seed); L = int(0.9 * SR); ir = np.zeros(L); pd = int(0.012 * SR)
    for ms, g in [(7, .5), (11, .38), (17, .3), (23, .22), (31, .16)]: ir[pd + int((ms + r.uniform(-1, 1)) * SR / 1000)] += g * r.choice([-1, 1])
    tt_ = np.arange(L - pd) / SR; tail = r.standard_normal(L - pd) * np.exp(-tt_ / 0.11) * np.clip(tt_ / 0.02, 0, 1) * 0.35
    ir[pd:] += lp(tail, 3200); return lp(ir, 5000)
dry = vo.copy()
for c in range(2):
    wet = fftconvolve(dry[:, c], warm_ir(41 + c), 'full')[:N]
    vo[:, c] += wet * (10 ** (-17 / 20)) / (np.sqrt(np.mean(wet ** 2)) / (np.sqrt(np.mean(dry[:, c] ** 2)) + 1e-12) + 1e-12)

# ── mix ──────────────────────────────────────────────────────────────────────
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
mus *= 10 ** (-25 / 20) / (np.sqrt(np.mean(mus ** 2)) + 1e-9)
duck = 1 - 0.68 * uniform_filter1d(vmask, int(0.3 * SR))                      # music about −7 dB under the narrator
fduck = 1 - 0.35 * uniform_filter1d(vmask, int(0.3 * SR))
lift = np.interp(np.arange(N) / SR, [0, 42.5, 43.5, 49.4, 50.1, 60], [1, 1, 1.5, 1.5, 1, 1])  # the wordless walk of lights: music up
sil = np.interp(np.arange(N) / SR, [0, 28.4, 28.6, 31.3, 31.4, 60], [1, 1, 0, 0, 1, 1])   # bar 10: silence under the narrator
mix = mus * (duck * lift * sil)[:, None] + fol * fduck[:, None] + amb + vo
mix[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))[:, None]
mix = limit(mix, .9)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
for nm, a, b in [('day', 5, 11), ('dark', 17, 24), ('silence', 28.6, 31.3), ('walk', 44, 50)]:
    i, j = int(a * SR), int(b * SR); print(f'{nm:8s} music {db(mus[i:j] * duck[i:j, None]):6.1f} dB  voice {db(vo[i:j]):6.1f} dB  foley {db(fol[i:j]):6.1f} dB')
bed = mus * (duck * lift * sil)[:, None] + fol * fduck[:, None] + amb
for e in [x for x in EV if x['type'] == 'voice']:
    i = int(e['t'] * SR); j = i + int(1.2 * SR); print(f"  {e['id']}: voice over bed {db(vo[i:j]) - db(bed[i:j]):5.1f} dB")
print('wrote out/mix.wav', mix.shape[0] / SR, 's')
