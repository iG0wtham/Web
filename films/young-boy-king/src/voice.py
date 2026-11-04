"""Narration for "The Young Boy" — offline Kokoro TTS.

Usage: python voice.py <kokoro.onnx> <voices.bin> <outdir>
Writes line_XX.wav (24 kHz mono) and lines.json with durations.
`say` is what the voice reads (phonetic spellings); `sub` is the on-screen subtitle.
"""
import json, sys, pathlib
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    dict(say="Nearly two thousand years ago, in the Pandya kingdom of Madurai, a boy was crowned king.",
         sub="Nearly 2,000 years ago, in the Pandya kingdom of Madurai, a boy was crowned king."),
    dict(say="His name was Neduncheliyan. He was still a teenager.",
         sub="His name was Nedunchezhiyan. He was still a teenager."),
    dict(say="Beyond his borders, the kings laughed. A mere boy, they said.",
         sub="Beyond his borders, the kings laughed. “A mere boy,” they said."),
    dict(say="The Chera king. The Chola king. And five chieftains beside them. Seven armies, joined as one.",
         sub="The Chera king. The Chola king. Five chieftains beside them. Seven armies, joined as one."),
    dict(say="The young king made a vow. If I do not crush them, let no poet ever sing my name.",
         sub="The young king made a vow: “If I do not crush them, let no poet ever sing my name.”"),
    dict(say="He marched out to meet them, at Thalaiyaalanganam.",
         sub="He marched out to meet them at Thalaiyalanganam."),
    dict(say="And there, the boy they had mocked shattered the entire alliance.",
         sub="And there, the boy they had mocked shattered the entire alliance."),
    dict(say="The poets have sung his name ever since.",
         sub="The poets have sung his name ever since."),
]

def main(model, voices, out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    k = Kokoro(model, voices)
    meta = []
    for i, ln in enumerate(LINES):
        audio, sr = k.create(ln["say"], voice="bm_george", speed=0.92, lang="en-gb")
        p = out / f"line_{i:02d}.wav"
        sf.write(p, audio, sr)
        meta.append(dict(i=i, file=p.name, dur=round(len(audio) / sr, 3), sub=ln["sub"]))
        print(i, meta[-1]["dur"])
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    main(*sys.argv[1:4])
