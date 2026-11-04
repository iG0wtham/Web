# Crayon Bedtime Tales: production playbook

For a fresh Claude Code session: read this first, then follow it. It gets you from an empty cloud machine to a finished film without rediscovering anything.

## The channel

- **YouTube:** Crayon Bedtime Tales · `@CrayonBedtimeTaless` (double "s" is intentional) · Gmail CrayonBedtimeTales@gmail.com
- **Audience:** ages 3–6, always uploaded as **"Made for kids"**. AI-use question → **No** (cartoon, no real people, no AI music).
- **Look:** Lemo-Opuscar **Crayon Picture Book** style: wax crayon on paper, one ultramarine watercolour for night.
- **Narrator:** Kokoro `af_sarah`, speed 0.78–0.86, short simple lines.
- **Music:** ukulele lilt (modelled `nylon_guitar`), recorder theme, glockenspiel per magic moment, shaker/woodblock; G major, ~84 bpm.
- **Credit line for every description:** *Crayon art style from Lemo-Opuscar by Lemomo (github.com/lemomo-ai/lemo-opuscar).*
- **Cadence:** 2–3 stories a week + a vertical Short of each. Vary characters, themes and lessons, so it never looks mass-produced.

## Episodes so far

| # | Folder | Story |
|---|---|---|
| 1 | `films/tuck-and-the-dark/` | Tuck the turtle is scared of the dark; Firefly shows him the night is full of little lights |

Reusable characters live in `films/tuck-and-the-dark/film.js` (`tuck()`, `firefly()`, `sun()`); channel art in `art.js` (`?art=banner|dp|thumb`).

## 1. Set up the machine (~5 min)

The user must approve running the library's setup script (the session's safety check blocks it otherwise). Ask once: *"OK to clone and run lemo-opuscar's setup?"*

```sh
git clone --depth 1 https://github.com/lemomo-ai/lemo-opuscar.git ~/lemo-opuscar
export LIB=~/lemo-opuscar
cd $LIB && sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice music   # Node, Chromium, Python venv, Kokoro voice
sh tools/fetch.sh instruments vcsl                                            # recorder, glockenspiel, woodblock, shaker (CC0)
# ffmpeg 7+ (the system has 6.1; johnvansickle.com is blocked): use the PyPI build
python3 -m venv ~/ffvenv && ~/ffvenv/bin/pip install -q imageio-ffmpeg
mkdir -p ~/bin && ln -sf $(~/ffvenv/bin/python -c "import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())") ~/bin/ffmpeg && ln -sf /usr/bin/ffprobe ~/bin/ffprobe
export PATH=~/bin:$PATH
```

Known network limits in these cloud sessions:
- **Hugging Face is blocked**, so `asr_check.py` (Whisper speech check) can't run. Skip it and say so to the user.
- Fonts come from `raw.githubusercontent.com/google/fonts/main/ofl/...` (github.com/raw redirects fail). Copy `films/tuck-and-the-dark/fonts/` into a new film instead of downloading again.

## 2. Make a new film

Follow `$LIB/AGENTS.md` (brief → treatment → look → storyboard → produce → self-check). In short:

1. **Brief in one message** (style, topic, length, format, voice, storyboard yes/no). Ask anything missing once.
2. **Copy the template:** `cp -r films/tuck-and-the-dark films/<new-name>`, then rewrite `TREATMENT.md`, `lines.json`, and the story parts of `film.js` (LINES, world, states, camera, events). Keep `gl.js`, `crayon.js`, `rig.js`, `main.js`, `index.html`, `fonts/`.
3. **Voice:** `$LIB/.venv/bin/python $LIB/core/tts/tts.py <film>/lines.json <film>/voices`, then put the durations from `voices/dur.json` into `film.js`.
4. **Storyboard:** `node $LIB/core/render/still.mjs <film> t1 t2 ... --out <film>/stills --prefix sb_`, then tile them with `sheet.py` (or PIL) and send the sheet to the user. **Wait for approval.**
5. **Events + mix:** `node $LIB/core/render/events.mjs <film>`, then `LIB=$LIB $LIB/.venv/bin/python <film>/mix.py`. Every line should be ≥ 6 dB over the bed (the script prints it).
6. **Subtitles:** `python subs.py && python $LIB/core/render/srt.py subs.json <name>.srt`
7. **Render** (~36 min for 60 s on this CPU-only machine; run it in the background):
   `node $LIB/core/render/video.mjs <film> --fps 24 --workers 3 --out <film>/out/video.mp4`
   Shorts: add `--size 1080x1920` and use the vertical camera (`camV` in `film.js`; `VERT` switches automatically).
8. **Mux:** `sh $LIB/core/render/mux.sh out/video.mp4 out/mix.wav <name>.mp4 24 0` (−14 LUFS).
9. **Shrink for git (GitHub refuses files over 100 MB):** re-encode from the master with
   `ffmpeg -i out/video.mp4 -i <name>.mp4 -map 0:v -map 1:a -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -c:a copy final.mp4`
   (the paper texture is heavy: CRF 26 was still 113 MB; CRF 30 gives ~48 MB).
10. **Checks:** blackdetect, ebur128, a look at the last seconds, a contact sheet; no "LemoLab" sign-off.
11. **Thumbnail:** add a `thumb` variant in `art.js` (big crayon words + the hero), render `?art=thumb`, scale to 1280×720.
12. **Deliver:** send the mp4, thumbnail, title, description and tags; commit and push.

## Saving usage

- Start a **new conversation for each film**; long conversations cost far more per message.
- One brief, one storyboard round, one fix round.
- Renders run in the background and cost almost nothing while they work.
