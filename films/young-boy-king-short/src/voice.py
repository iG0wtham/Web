"""Narration + word timings for the Shorts cut of "The Young Boy".

Usage: python voice.py <kokoro.onnx> <voices.bin> <outdir>
Each line is synthesized on its own (natural prosody inside a line, exact line
boundaries). Word times inside a line are spread over the voiced span in
proportion to each word's phoneme count, which is close enough for captions.
`say` is what the voice reads (phonetic spellings); `show` is what the captions show.
"""
import json, sys, pathlib, re
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE, SPEED, LANG = "am_michael", 1.08, "en-us"
GAP_AFTER = 0.28  # pause between lines (seconds); per-line overrides below
LINES = [
    dict(say="This teenager just became king.", gap=0.15, shot="hook_crown"),
    dict(say="And seven armies want him dead.", gap=0.5, shot="hook_armies", hl=["seven", "dead."]),
    dict(say="Two thousand years ago in South India, Neduncheliyan took the Pandya throne.", gap=0.15, shot="throne",
         show="2,000 years ago in South India, Nedunchezhiyan took the Pandya throne.", hl=["Nedunchezhiyan"]),
    dict(say="He was just a teenager.", gap=0.35, shot="throne_close", hl=["teenager."]),
    dict(say="His neighbors saw an easy target.", gap=0.25, shot="tent_laugh", hl=["easy", "target."]),
    dict(say="The mighty Chera king.", gap=0.12, shot="chera", hl=["Chera"]),
    dict(say="The Chola king.", gap=0.12, shot="chola", hl=["Chola"]),
    dict(say="And five chieftains.", gap=0.3, shot="chiefs", hl=["five"]),
    dict(say="Seven armies.", gap=0.25, shot="armies_wide", hl=["Seven"]),
    dict(say="Against one boy.", gap=0.45, shot="lone_boy", hl=["one", "boy."]),
    dict(say="But the boy made a vow.", gap=0.3, shot="vow", hl=["vow."]),
    dict(say="If I don't crush them, let no poet ever sing my name.", gap=0.45, shot="vow_sword", hl=["crush"]),
    dict(say="He didn't wait for them to come.", gap=0.12, shot="gate"),
    dict(say="He marched out to meet them, at Thalaiyaalanganam.", gap=0.5, shot="march",
         show="He marched out to meet them, at Thalaiyalanganam.", hl=["Thalaiyalanganam."]),
    dict(say="And the boy they laughed at,", gap=0.2, shot="charge"),
    dict(say="crushed all seven armies.", gap=0.6, shot="battle", hl=["crushed", "seven", "armies."]),
    dict(say="Poets have been singing his name for two thousand years.", gap=1.4, shot="ending",
         show="Poets have been singing his name for 2,000 years.", hl=["2,000", "years."]),
]

def voiced_span(a, sr, thr=0.02):
    env = np.convolve(np.abs(a), np.ones(int(0.01 * sr)) / int(0.01 * sr), mode="same")
    idx = np.where(env > thr * env.max())[0]
    return (idx[0] / sr, idx[-1] / sr) if len(idx) else (0, len(a) / sr)

def main(model, voices, out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    k = Kokoro(model, voices)
    t, words, lines, chunks, sr = 0.4, [], [], [], 24000
    for i, ln in enumerate(LINES):
        audio, sr = k.create(ln["say"], voice=VOICE, speed=SPEED, lang=LANG)
        a0, a1 = voiced_span(audio, sr)
        say_w, show_w = ln["say"].split(), ln.get("show", ln["say"]).split()
        # phoneme weight per spoken word, mapped onto shown words by position
        w = np.array([max(1, len(re.sub(r"[^\w]", "", k.tokenizer.phonemize(x, LANG)))) for x in say_w], float)
        if len(show_w) != len(say_w):  # e.g. "Two thousand" shown as "2,000": merge weights from the left
            merged, j = [], 0
            for s in show_w:
                take = 2 if s[:1].isdigit() and len(say_w) - j > len(show_w) - len(merged) else 1
                merged.append(w[j:j + take].sum()); j += take
            merged[-1] += w[j:].sum(); w = np.array(merged)
        edges = a0 + (a1 - a0) * np.concatenate([[0], np.cumsum(w) / w.sum()])
        for j, s in enumerate(show_w):
            words.append(dict(w=s, t0=round(t + edges[j], 3), t1=round(t + edges[j + 1], 3), line=i, hl=s in ln.get("hl", [])))
        lines.append(dict(i=i, shot=ln["shot"], t0=round(t, 3), t1=round(t + len(audio) / sr, 3), v0=round(t + a0, 3), v1=round(t + a1, 3)))
        chunks.append((t, audio))
        t += len(audio) / sr + ln.get("gap", GAP_AFTER)
    total = t
    mix = np.zeros(int(total * sr) + sr)
    for t0, a in chunks:
        i0 = int(t0 * sr); mix[i0:i0 + len(a)] += a
    sf.write(out / "narration.wav", mix, sr)
    (out / "timing.json").write_text(json.dumps(dict(duration=round(total, 3), lines=lines, words=words), indent=1, ensure_ascii=False))
    print(f"total {total:.2f}s, {len(words)} words")
    for l in lines: print(l["i"], l["shot"], l["t0"], l["t1"])

if __name__ == "__main__":
    main(*sys.argv[1:4])
