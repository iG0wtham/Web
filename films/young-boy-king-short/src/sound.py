"""Music, sound design and mix for the Shorts cut — all synthesized.

Shorts-style: a dark cinematic bed that builds, a whoosh on every cut, booms on key
words, a riser into the vow, marching drums, a battle hit, a warm resolve at the end.
Usage: python sound.py <timing.json> <narration.wav> <out.wav>
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

SR = 48000
rng = np.random.default_rng(3)
TM = json.load(open(sys.argv[1]))
N = int((TM["duration"] + .4) * SR)
mus = np.zeros((N, 2)); sfx = np.zeros((N, 2))
L = TM["lines"]; WORDS = TM["words"]
cut = [0] + [l["t0"] - .08 for l in L[1:]]
def wt(line, k): ws = [w for w in WORDS if w["line"] == line]; return ws[min(k, len(ws) - 1)]["t0"]

def t_(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype="high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], btype="band", fs=SR, output="sos"), x)
def add(buf, at, x, g=1.0, pan=0.0, width=0.0):
    i = int(at * SR)
    if i >= N or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[: N - i] * g; l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    if width:
        d = int(width * SR); xr = np.concatenate([np.zeros(d), x[:-d]]) if d else x
        buf[i:i + len(x), 0] += x * l; buf[i:i + len(x), 1] += xr * r
    else:
        buf[i:i + len(x), 0] += x * l; buf[i:i + len(x), 1] += x * r

# ── sound design ─────────────────────────────────────────────────────────────
def whoosh(d=.45, lo=300, hi=3000):
    t = t_(d); n = rng.standard_normal(len(t)); env = np.sin(np.pi * np.minimum(1, t / d)) ** 3
    f = lo + (hi - lo) * np.sin(np.pi * t / d)
    out = np.zeros_like(n); y = 0
    a = np.exp(-2 * np.pi * f / SR)
    for i in range(len(n)): y = a[i] * y + (1 - a[i]) * n[i]; out[i] = y
    return hp(out, 150) * env * 3
def boom(d=2.5, f0=55):
    t = t_(d); f = f0 * (1 + 1.5 * np.exp(-t / .04))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .7)
    n = lp(rng.standard_normal(len(t)), 900) * np.exp(-t / .25) * .6
    return np.tanh(1.8 * (s + n))
def hit(d=1.2):
    t = t_(d); return np.tanh(2.5 * (np.sin(2 * np.pi * 70 * (1 + 2 * np.exp(-t / .02)) * t) * np.exp(-t / .2) + bp(rng.standard_normal(len(t)), 400, 5000) * np.exp(-t / .06)))
def riser(d=2.0):
    t = t_(d); f = 200 * 2 ** (3 * t / d); s = np.zeros_like(t)
    for k, det in enumerate([1, 1.006, .994, 2.01]): s += np.sin(2 * np.pi * np.cumsum(f * det) / SR + k)
    n = hp(rng.standard_normal(len(t)), 2000) * (t / d) ** 2
    return (s * .15 + n * .5) * (t / d) ** 2.2
def shing(d=1.8):
    t = t_(d); x = np.zeros_like(t)
    for f in [2350, 3720, 5130, 6890, 8210]: x += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / (0.4 + rng.random() * .6))
    sweep = bp(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / .08)
    return x / 5 * .7 + sweep * .5
def ding(d=2.5):
    t = t_(d); x = sum(np.sin(2 * np.pi * 1320 * r * t) * a * np.exp(-t / dd) for r, a, dd in [(1, 1, 1.2), (2.76, .4, .5), (5.4, .2, .25)])
    return x * .5
def thunder(d=3.5):
    t = t_(d); n = lp(rng.standard_normal(len(t)), 600) * (np.exp(-t / 1.0) + .5 * np.exp(-((t - .4) / .3) ** 2))
    crack = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t / .05)
    return np.tanh(2 * n) * .8 + crack * .6
def rumble(d):
    t = t_(d); return lp(rng.standard_normal(len(t)), 220) * 1.5 * np.minimum(1, t / .5) * np.minimum(1, (d - t) / .5)
def crowd(d):
    t = t_(d); x = np.zeros_like(t)
    for k in range(10): x += bp(rng.standard_normal(len(t)), 300 + k * 90, 900 + k * 120) * (1 + .5 * np.sin(2 * np.pi * (0.7 + k * .13) * t + k))
    return x / 10 * np.minimum(1, t / .3) * np.minimum(1, (d - t) / .6) * 2
def clang():
    t = t_(.5); x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / .1) for f in [1800 + rng.random() * 800, 3100 + rng.random() * 900, 4700])
    return x / 3 + bp(rng.standard_normal(len(t)), 2000, 8000) * np.exp(-t / .02)
def wind(d):
    t = t_(d); return bp(rng.standard_normal(len(t)), 200, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * .3 * t)) * np.minimum(1, t / .4) * np.minimum(1, (d - t) / .4)
def step():
    t = t_(.15); return lp(rng.standard_normal(len(t)), 500) * np.exp(-t / .03)

# ── music ────────────────────────────────────────────────────────────────────
def note(m): return 440 * 2 ** ((m - 69) / 12)
def pad(chord, d, cutoff=900, g=1.0):
    t = t_(d); x = np.zeros_like(t)
    for m in chord:
        for det in (-.08, 0, .08):
            f = note(m + det); ph = 2 * np.pi * f * t + rng.random() * 6
            x += sum(np.sin(k * ph) / k for k in range(1, 9))
    x = lp(x / (len(chord) * 3), cutoff)
    return x * np.minimum(1, t / .6) * np.minimum(1, (d - t) / .6) * g * .5
def pluck(m, d=.4):
    t = t_(d); f = note(m); x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 * np.exp(-t * (5 + k * 2)) for k in range(1, 8)); return x * .5
def taiko(f0=70):
    t = t_(.9); return np.tanh(2 * (np.sin(2 * np.pi * np.cumsum(f0 * (1 + .8 * np.exp(-t / .03))) / SR) * np.exp(-t / .25) + lp(rng.standard_normal(len(t)), 1500) * np.exp(-t / .015) * .5))
def snare():
    t = t_(.3); return bp(rng.standard_normal(len(t)), 1500, 7000) * np.exp(-t / .07) * .6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / .05) * .4

Dm, Bb, Gm, A, D = [50, 57, 62, 65], [46, 58, 62, 65], [43, 55, 62, 67], [45, 57, 61, 64], [50, 57, 62, 66]
BPM = 100; B = 60 / BPM
def chords(a, b, prog, cutoff, g):
    t = a; i = 0
    while t < b - .1:
        d = min(4 * B, b - t) + .6; add(mus, t, pad(prog[i % len(prog)], d, cutoff, g), 1, pan=0, width=.012); t += 4 * B; i += 1
def ostinato(a, b, root=62, g=.35):
    seq = [0, 3, 7, 3, 10, 7, 3, 7]; t = a; k = 0
    while t < b: add(mus, t, pluck(root + seq[k % 8] - 12), g, pan=-.3 + .6 * (k % 2)); t += B / 2; k += 1
def drums(a, b, g=1.0, dense=False):
    t = a; k = 0
    while t < b:
        add(mus, t, taiko(65), .9 * g)
        if k % 2 == 1: add(mus, t, snare(), .5 * g)
        if dense: add(mus, t + B / 2, taiko(90), .45 * g)
        t += B; k += 1

# hook (0 → line 2)
add(mus, 0, pad([38, 45, 50], L[2]["t0"], 400, 1.2), 1, width=.01)
add(sfx, L[0]["t0"] - .1, whoosh(.5), .5)
add(sfx, wt(0, 4) - .05, ding(), .5)                      # crown lands on "king"
add(sfx, cut[1], whoosh(.5, 200, 2500), .7)
add(sfx, wt(1, 2), boom(2.5, 45), 1.0)                   # "seven"
add(sfx, wt(1, 5), hit(), .8); add(sfx, wt(1, 5), boom(3, 38), 1.0)  # "dead."
add(sfx, cut[1], rumble(cut[2] - cut[1]), .6)
# story: palace
chords(cut[2], cut[4], [Dm, Bb], 700, .9)
ostinato(cut[3], cut[4], g=.25)
# the enemies
chords(cut[4], cut[10], [Gm, A, Dm, Bb], 1100, 1.0)
ostinato(cut[4], cut[10], g=.33)
drums(cut[5], cut[10], .7)
for i in (5, 6): add(sfx, wt(i, 2), boom(2, 50), .9); add(sfx, wt(i, 2), hit(), .5)
for k in range(5): add(sfx, lerp_t := wt(7, 1) + k * .18, taiko(110), .35)
add(sfx, wt(8, 0), boom(2.5, 40), 1.1); add(sfx, wt(8, 0), hit(), .7)  # "Seven armies"
add(sfx, cut[8], rumble(cut[10] - cut[8]), .7); add(sfx, cut[8], crowd(cut[10] - cut[8]), .25)
add(sfx, cut[9], wind(cut[10] - cut[9] + .5), .4)
# the vow: drop, riser, lightning on "crush"
crush = wt(11, 3)
add(mus, cut[10], pad([38, 45], cut[12] - cut[10] + .3, 300, 1.3), 1)
add(sfx, cut[10], wind(cut[12] - cut[10]), .25)
add(sfx, crush - 2.0, riser(2.0), .55)
add(sfx, crush - .55, shing(), .7)                        # the sword comes up
add(sfx, crush, thunder(), 1.0); add(sfx, crush, boom(3, 36), 1.0)
for c in cut[1:]: add(sfx, c - .12, whoosh(.38, 400, 4000), .35)
# the march
chords(cut[12], cut[14], [Dm, Bb, Gm, A], 1600, 1.0)
ostinato(cut[12], cut[14], g=.4)
drums(cut[12], cut[14], 1.0)
t = cut[12]
while t < cut[14]: add(sfx, t, step(), .25); add(sfx, t + B / 2, step(), .18); t += B
add(sfx, cut[12], rumble(cut[14] - cut[12]), .5)
add(sfx, cut[13] + .5, hit(), .4)                         # location stamp
# charge → battle
add(sfx, cut[14], riser(cut[15] - cut[14]), .6)
drums(cut[14], cut[15], 1.0, dense=True)
add(sfx, cut[14], crowd(cut[16] - cut[14]), .5)
add(sfx, cut[15], boom(3.5, 34), 1.2); add(sfx, cut[15], hit(), 1.0)
for k in range(9): add(sfx, cut[15] + .15 + k * .22, clang(), .35, pan=rng.uniform(-.6, .6))
for k in range(3): add(sfx, cut[15] + .15 + k * .35, boom(1.5, 60), .6)
chords(cut[15], cut[16], [Dm, A], 2500, 1.1)
add(sfx, wt(15, 3), boom(3, 36), 1.0)                     # "armies."
# resolve
add(mus, cut[16], pad(D, TM["duration"] - cut[16] + .3, 1400, 1.1), 1, width=.012)
add(mus, cut[16], pad([62, 69, 74, 78], TM["duration"] - cut[16] + .3, 2500, .5), 1, width=.02)
for k, m in enumerate([74, 78, 81, 86]): add(mus, cut[16] + .3 + k * .5, pluck(m, 1.5), .35, pan=-.4 + k * .25)
add(sfx, cut[16], wind(TM["duration"] - cut[16]), .3)

# ── mix ──────────────────────────────────────────────────────────────────────
v, sr = sf.read(sys.argv[2]); v = v if v.ndim == 1 else v.mean(1)
v = resample_poly(v, SR, sr)[:N]; v = v / (np.abs(v).max() + 1e-9)
voice = np.zeros((N, 2)); voice[:len(v), 0] = v; voice[:len(v), 1] = v
# presence: gentle high-mid lift for the narrator
voice = voice + .25 * np.stack([bp(voice[:, 0], 2500, 6000), bp(voice[:, 1], 2500, 6000)], 1)
env = np.convolve(np.abs(voice[:, 0]), np.ones(int(.2 * SR)) / int(.2 * SR), mode="same"); env = np.minimum(1, env / (np.percentile(env[env > 1e-3], 60) + 1e-9))
mus *= (1 - .6 * env)[:, None]; sfx *= (1 - .3 * env)[:, None]
mix = .85 * voice + .32 * mus / (np.abs(mus).max() + 1e-9) + .55 * sfx / (np.abs(sfx).max() + 1e-9)
fo = int(.8 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() + 1e-9; mix *= .9
sf.write(sys.argv[3], mix.astype(np.float32), SR, subtype="FLOAT")
print("wrote", sys.argv[3], f"{N / SR:.1f}s")
