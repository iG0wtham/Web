#!/bin/sh
# Rebuild "Tuck and the Dark" from scratch. Needs the Lemo-Opuscar library with the voice tier and the vcsl samples,
# and ffmpeg 7+ on PATH.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-/tmp/claude-0/-home-user-Web/ce31de17-2d0e-5667-b7db-f432644c0b24/scratchpad/ext/lemo-opuscar}
export LIB
cd "$LIB"
PY=.venv/bin/python
$PY core/tts/tts.py "$HERE/lines.json" "$HERE/voices"                 # 1. narration (Kokoro af_sarah)
$PY core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices" || echo "! speech check failed or unavailable"   # 2. speech-to-text check
node core/render/events.mjs "$HERE"                                     # 3. timeline → events.json
$PY "$HERE/mix.py"                                                       # 4. score + foley + narration → out/mix.wav
$PY "$HERE/subs.py" && $PY core/render/srt.py "$HERE/subs.json" "$HERE/tuck-and-the-dark.srt"   # 5. subtitles
node core/render/video.mjs "$HERE" --fps 24 --workers 3 --out "$HERE/out/video.mp4"            # 6. picture
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/tuck-and-the-dark.mp4" 24 0   # 7. mux, −14 LUFS, no extra grain (the paper is the grain)
