"""Score, foley and mix for "The Young Boy" — everything synthesized, nothing sampled.

Percussion first (barrel drum, hand cymbals, woodblock, gongs), a tanpura-like drone,
and one nasal reed melody (Mohanam pentatonic) for the victory. Hits follow timeline.json.
Usage: python score.py <timeline.json> <voice dir> <out.wav>
"""
import json, sys, pathlib
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

SR = 48000
rng = np.random.default_rng(7)
TL = json.loads(pathlib.Path(sys.argv[1]).read_text())
VOICE = pathlib.Path(sys.argv[2])
N = int(TL["duration"] * SR)
music = np.zeros((N, 2)); foley = np.zeros((N, 2)); voice = np.zeros((N, 2))

def t_(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)
def add(buf, at, x, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    x = x[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * l * 1.414; buf[i:i + len(x), 1] += x * r * 1.414

# ── instruments ──────────────────────────────────────────────────────────────
def drum(f0=140, f1=52, d=0.9, decay=0.28):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    click = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.008) * 0.5
    return np.tanh(1.6 * (body + click))

def woodblock(f=900, d=0.18):
    t = t_(d)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t / 0.03) + bp(rng.standard_normal(len(t)), f, f * 3) * np.exp(-t / 0.005) * 0.6

def thalam(d=0.7):  # small hand cymbals
    t = t_(d); x = np.zeros_like(t)
    for f in [3120, 4380, 5230, 6610, 7940, 9050]:
        x += np.sin(2 * np.pi * f * (1 + 0.002 * rng.standard_normal()) * t + rng.random() * 6) * np.exp(-t / (0.12 + rng.random() * 0.2))
    return x / 6 + hp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.03) * 0.3

def crash(d=2.5):
    t = t_(d); n = hp(rng.standard_normal(len(t)), 2500)
    return (n * np.exp(-t / 0.7) + thalam(d) * 0.6) * 0.7

def gong(f0=110, d=5.0, fall=0.06, rise=0.0):
    t = t_(d); x = np.zeros_like(t)
    glide = 1 - fall * (1 - np.exp(-t / 0.4)) + rise * (1 - np.exp(-t / 0.25))
    for k, (ratio, amp, dec) in enumerate([(1, 1, 3.0), (1.47, .6, 2.2), (2.09, .5, 1.8), (2.56, .35, 1.2), (3.12, .3, .9), (4.2, .2, .6), (5.4, .15, .4)]):
        ph = 2 * np.pi * np.cumsum(f0 * ratio * glide) / SR
        x += amp * np.sin(ph + k) * np.exp(-t / dec) * (1 + 0.15 * np.sin(2 * np.pi * (1.3 + k * .4) * t))
    att = np.minimum(1, t / 0.01)
    return np.tanh(1.2 * x * att) * 0.8

def gong_scrape(d=1.6):
    t = t_(d); f = 600 + 1800 * t / d
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(rng.standard_normal(len(t)), 900, 4000) * 0.6
    return x * np.sin(np.pi * t / d) ** 2

def whoosh(d=0.8, lo=200, hi=1200):  # lamp fwoomp / leather flap
    t = t_(d); return bp(rng.standard_normal(len(t)), lo, hi) * np.sin(np.pi * np.minimum(1, t / d)) ** 2

def snuff(d=0.6):
    t = t_(d); return hp(rng.standard_normal(len(t)), 1500) * np.exp(-t / 0.05) * 0.6 + bp(rng.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.25) * 0.15

def thud(d=0.25):
    t = t_(d); return lp(rng.standard_normal(len(t)), 300) * np.exp(-t / 0.04) * 2 + np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.06)

def tanpura(f, d=3.2):
    t = t_(d); x = np.zeros_like(t)
    for k in range(1, 24):
        buzz = 1 + 0.7 * np.sin(2 * np.pi * (0.5 + 0.05 * k) * t + k) if k > 4 else 1
        x += (1 / k ** 0.8) * np.sin(2 * np.pi * f * k * t + rng.random() * 6) * np.exp(-t / (2.4 - 0.05 * k)) * buzz
    return lp(x * np.minimum(1, t / 0.01), 5000) * 0.12

def reed(notes, sa=293.66):  # nasal double reed: band-limited saw, glides, vibrato, formant, saturation
    total = sum(d for _, d in notes); t = t_(total + 0.4)
    f = np.zeros_like(t); pos = 0.0; prev = None
    for deg, d in notes:
        i0, i1 = int(pos * SR), int((pos + d) * SR)
        tgt = sa * deg
        seg = np.full(i1 - i0, tgt)
        if prev is not None:
            g = min(len(seg), int(0.07 * SR)); seg[:g] = prev + (tgt - prev) * (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, g)))
        f[i0:i1] = seg; prev = tgt; pos += d
    f[int(pos * SR):] = prev
    f *= 1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.6)
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.zeros_like(t)
    for k in range(1, 18): x += np.sin(k * ph) / k
    x = x + 1.5 * bp(x, 1200, 3000)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (t[-1] - t) / 0.35)
    return np.tanh(2.2 * x) * env * 0.35

def reverb(x, rt=1.2, wet=0.25):
    ir_t = t_(rt); ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 6.9 / rt); ir = lp(ir, 4000); ir /= np.sqrt(np.sum(ir ** 2))
    out = np.zeros_like(x)
    for c in range(2):
        y = np.fft.irfft(np.fft.rfft(x[:, c], len(x) + len(ir)) * np.fft.rfft(ir, len(x) + len(ir)))[: len(x)]
        out[:, c] = x[:, c] + wet * y
    return out

# ── the score along the timeline ─────────────────────────────────────────────
SA = 146.83  # D3
def drone(a, b, gain=1.0):
    t = a; seq = [1.5, 2, 2, 1]
    i = 0
    while t < b:
        add(music, t, tanpura(SA * seq[i % 4], 3.2), gain * (0.9 if i % 4 else 0.7), pan=-0.3 + 0.2 * (i % 4))
        t += 1.15; i += 1

# opening: lamps light, title pressed on
for i, at in enumerate(TL["lamps_on"]):
    add(foley, at - 0.15, whoosh(0.7, 150, 900), 0.5, pan=-0.4 + 0.4 * i); add(music, at, woodblock(820 + 120 * i), 0.5)
add(music, TL["title_on"] - 0.4, np.concatenate([woodblock(1000) * (0.3 + 0.1 * k) for k in range(4)])[: int(0.4 * SR)], 0.6)
add(music, TL["title_on"], drum(), 0.9); add(music, TL["title_on"], crash(2.0), 0.35)
add(foley, TL["title_off"], whoosh(0.5, 300, 2000), 0.35)
drone(1.0, TL["whip_back"] + 0.4, 0.8)

# the boy enters: steps on the cymbals
for s in TL["boy_steps"]:
    add(foley, s, thud(), 0.35); add(music, s, thalam(0.5), 0.25, pan=0.2)
add(music, TL["boy_steps"][-1] + 0.5, drum(160, 70, .6), 0.5)
add(music, TL["head_turn"], woodblock(1100), 0.45)

# to the rival kings: a gong scrape, then their laughter as a rattling clapper
add(music, TL["pan_to_kings"], gong_scrape(1.6), 0.4)
add(music, TL["pan_to_kings"] + 1.5, gong(98, 3.5, .08), 0.5)
a, b = TL["laugh"]; t = a; k = 0
while t < b:
    add(music, t, woodblock(1300 - 8 * k, .1), 0.35 * (1 - (t - a) / (b - a) * .6), pan=0.4); t += 0.11 + 0.002 * k; k += 1

# seven armies, one beat each
add(music, TL["banner_chera"], drum(150, 55), 0.9); add(music, TL["banner_chera"], crash(1.5), 0.3, -0.3)
add(music, TL["banner_chola"], drum(150, 50), 0.9); add(music, TL["banner_chola"], crash(1.5), 0.3, 0.3)
for i, at in enumerate(TL["banner_chiefs"]):
    add(music, at, woodblock(700 + 110 * i), 0.55, pan=-0.5 + 0.25 * i); add(music, at, drum(120, 60, .4, .12), 0.4)
for k in range(10):  # roll into the alliance
    add(music, TL["join"] - 1.0 + k * 0.1 * (1 - k * 0.04), drum(170, 90, .2, .06), 0.25 + 0.04 * k)
add(music, TL["join"], gong(82, 5.0, .1), 1.0); add(music, TL["join"], drum(120, 40, 1.2, .4), 0.9)
# dread: heartbeat drum, then a hard stop into silence
t = TL["join"] + 0.6
while t < TL["whip_back"] + 0.4:
    add(music, t, drum(70, 40, .3, .1), 0.6); add(music, t + 0.22, drum(70, 40, .3, .1), 0.4); t += 0.82
SIL_A, SIL_B = TL["whip_back"] + 0.6, TL["flare"]
add(music, TL["whip_back"], whoosh(0.5, 400, 3000), 0.35)

# the vow: one tap inside the silence, a rising gong, then everything at once
add(foley, TL["vow_tap"], woodblock(950, .2), 0.45)
add(music, TL["sword_up"], gong(160, 1.2, 0, .12), 0.5)
add(music, TL["flare"], gong(73, 6.0, .12), 1.1); add(music, TL["flare"], drum(130, 38, 1.4, .5), 1.0); add(music, TL["flare"], crash(3.0), 0.45)
add(foley, TL["flare"] - 0.1, whoosh(0.9, 100, 700), 0.8)
drone(TL["flare"] + 0.2, TL["flash"] + 0.2, 0.9)

# roll into the march
for k in range(16):
    tt = TL["flash"] - 0.9 + 0.9 * (1 - (1 - k / 16) ** 1.6)
    add(music, tt, drum(180, 90, .2, .05), 0.25 + 0.035 * k)
add(music, TL["flash"], crash(2.5), 0.6); add(music, TL["flash"], drum(150, 45, 1.0, .35), 1.0)

# the march: thavil-like pattern at 120 bpm
bt = 0.5; t = TL["march"]; k = 0
while t < TL["clash"] - 0.05:
    add(music, t, drum(140, 55, .5, .16), 0.75 if k % 2 == 0 else 0.5, pan=-0.1)
    add(music, t, thalam(0.4), 0.22, pan=0.25)
    add(music, t + bt / 2, woodblock(1000 if k % 2 else 900, .1), 0.3, pan=0.3)
    if k % 4 == 3: add(music, t + bt * .75, drum(200, 100, .2, .05), 0.4)
    add(foley, t, thud(.2), 0.18)
    t += bt; k += 1
drone(TL["march"], TL["clash"], 0.6)

# the battle
add(music, TL["clash"], gong(70, 5.0, .12), 1.1); add(music, TL["clash"], crash(3.0), 0.6); add(music, TL["clash"], drum(150, 40, 1.4, .5), 1.0)
t = TL["clash"] + 0.25; k = 0
while t < TL["final_hit"] - 0.1:
    add(music, t, drum(190 if k % 3 else 140, 80, .25, .07), 0.35 + 0.1 * (k % 4 == 0)); t += 0.125; k += 1
for f in TL["falls"]:
    add(music, f, drum(130, 42, 1.0, .35), 0.9); add(music, f, thalam(.8), 0.35); add(foley, f, whoosh(.6, 200, 1500), 0.5); add(foley, f + .05, thud(.3), .6)
add(music, TL["final_hit"], gong(65, 7.0, .14), 1.2); add(music, TL["final_hit"], drum(120, 36, 1.6, .6), 1.1); add(music, TL["final_hit"], crash(3.5), 0.6)

# victory: the reed, once
S, R, G, Pa, D = 1, 9 / 8, 5 / 4, 3 / 2, 5 / 3
melody = [(Pa, .35), (D, .35), (2, .7), (D, .25), (2, .25), (2 * R, .55), (2, .4), (D, .4), (Pa, .8), (G, .35), (Pa, .35), (D, .5), (2, 1.4)]
add(music, TL["victory"] + 0.2, reed(melody), 0.75, pan=0.1)
drone(TL["victory"], TL["dark"] - 1.5, 0.9)
for k, at in enumerate([TL["victory"] + 0.2, TL["victory"] + 1.6, TL["victory"] + 3.0, TL["victory"] + 4.4]):
    add(music, at, drum(120, 50, .8, .3), 0.5); add(music, at, thalam(.6), 0.2)

# the end: lamps carried away, a soft gong for the card
for i in range(4): add(foley, TL["lamps_away"] + i * 0.9 + 0.8, snuff(), 0.45, pan=-0.5 + i * 0.33)
add(music, TL["end_card"], gong(110, 4.0, .05), 0.5)

# ── voice ────────────────────────────────────────────────────────────────────
meta = json.loads((VOICE / "lines.json").read_text())
for i, m in enumerate(meta):
    x, sr = sf.read(VOICE / m["file"])
    if x.ndim > 1: x = x.mean(axis=1)
    x = resample_poly(x, SR, sr)
    add(voice, TL["lines"][i], x / (np.max(np.abs(x)) + 1e-9), 0.8)
voice = reverb(voice, 0.7, 0.18)

# ── mix ──────────────────────────────────────────────────────────────────────
music = reverb(music, 1.6, 0.28); foley = reverb(foley, 0.8, 0.2)
# silence before the vow: hard-cut the bed (tails included)
i0, i1 = int(SIL_A * SR), int(SIL_B * SR)
fade = int(0.02 * SR)
music[i0:i0 + fade] *= np.linspace(1, 0, fade)[:, None]; music[i0 + fade:i1] = 0
# duck the bed under the voice (~ -11 dB)
env = np.abs(voice).mean(axis=1)
k = int(0.25 * SR); env = np.convolve(env, np.ones(k) / k, mode="same"); env = np.minimum(1, env / (np.percentile(env[env > 1e-4], 50) + 1e-9))
duck = 1 - 0.72 * env
music *= duck[:, None]; foley *= (1 - 0.35 * env)[:, None]
mix = 0.55 * music + 0.6 * foley + 1.0 * voice
# hard stop at the end
end = int((TL["dark"] + 0.3) * SR); mix[end:end + int(0.03 * SR)] *= np.linspace(1, 0, int(0.03 * SR))[:, None]; mix[end + int(0.03 * SR):] = 0
mix /= np.max(np.abs(mix)) + 1e-9; mix *= 0.89
sf.write(sys.argv[3], mix.astype(np.float32), SR, subtype="FLOAT")
print("wrote", sys.argv[3], f"{len(mix) / SR:.1f}s")
