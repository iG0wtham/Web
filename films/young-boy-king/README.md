# The Young Boy — Nedunchezhiyan at Thalaiyalanganam

A 55-second shadow-theatre history short (1920×1080, 24 fps, English narration), made entirely in code:
no video generation, no stock footage, no samples.

**Watch:** [`the-young-boy.mp4`](the-young-boy.mp4)

## The story

Nedunchezhiyan came to the Pandya throne in Madurai as a teenager. Thinking him a mere boy, the Chera and
Chola kings and five chieftains joined forces against him. He vowed that if he did not crush them, poets
should never sing his name, and he met the alliance at Thalaiyalanganam (present-day Tiruvarur district,
Tamil Nadu) and defeated it.

The film follows that in seven beats: the lamps are lit; the boy king in Madurai; the rival kings laugh;
seven banners join as one; the vow (the theatre goes silent, then every lamp flares); the march to
Thalaiyalanganam; the alliance's banners knocked off the cloth one group at a time; the victory; the lamps carried away.

## How it is made

| Layer | How |
|---|---|
| Picture | `src/film.html`: a 2D-canvas shadow-theatre engine. Each puppet piece is a dyed, hide-textured sprite with carved holes, drawn with `multiply` onto a white transmission layer, then lit by flickering oil-lamp gradients through a woven cloth, with warm bloom, vignette and grain. Jointed puppets with hand tremor, press-on / lift-off blur, rods, crash zooms on drum hits. Pandya twin-fish, Chera bow and Chola tiger emblems are carved into the banners. |
| Voice | `src/voice.py`: offline Kokoro TTS (`bm_george`). Spelling is phonetic for the voice; subtitles keep the proper spellings. |
| Music & foley | `src/score.py`: synthesized barrel drums, hand cymbals, woodblock, gongs, a tanpura-like drone and one nasal reed melody in Mohanam pentatonic, all hit-synced to `src/timeline.json`; voice reverb, ducking, a hard-cut silence before the vow. |
| Render | `src/render.js`: headless Chromium (Playwright) draws each frame and pipes it to ffmpeg. |

Visual direction follows the **Shadow Puppetry** style prompt from
[Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar) by Lemomo (style prompts CC BY 4.0); all code
here is new. Shadow theatre also has a Tamil tradition of its own, *tholpavakoothu*.

## Rebuild

Needs Node 20+ with `playwright`, ffmpeg, Python 3.11+ with `kokoro-onnx soundfile numpy scipy`, and the
Kokoro model files (`kokoro-v1.0.int8.onnx`, `voices-v1.0.bin`) from the kokoro-onnx releases.

```sh
python src/voice.py kokoro-v1.0.int8.onnx voices-v1.0.bin audio/voice   # narration + lines.json
python src/score.py src/timeline.json audio/voice audio/mix_raw.wav     # score, foley, mix
node   src/render.js video picture.mp4                                  # picture (≈30 min on CPU)
node   src/render.js stills frames 3.4 13.5 33 42                       # or just a few style frames
ffmpeg -i picture.mp4 -i audio/mix_raw.wav -map 0:v -map 1:a -c:v copy \
       -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 -shortest the-young-boy.mp4
```

To retime anything, edit `src/timeline.json`: picture and score both read it.
