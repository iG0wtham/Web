# Export the film's subtitles (same LINES and hold rule as film.js) → subs.json for core/render/srt.py
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
js = open(os.path.join(HERE, 'film.js')).read()
durs = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
lines = [(i, float(t), txt.replace('\\"', '"')) for i, t, txt in re.findall(r"\['(n\d+)', ([\d.]+), '((?:[^'\\]|\\.)*)'\]", js)]
subs = []
for k, (i, t, txt) in enumerate(lines):
    t0 = t - 0.1; t1 = max(t0 + 1.8, t + durs[i] + 0.7)
    if k + 1 < len(lines): t1 = min(t1, lines[k + 1][1] - 0.25)
    subs.append(dict(t0=round(t0, 3), t1=round(t1, 3), text=txt))
json.dump(subs, open(os.path.join(HERE, 'subs.json'), 'w'), indent=1, ensure_ascii=False)
print(len(subs), 'subtitles')
