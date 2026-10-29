<p align="center">
  <img src="public/logo.svg" width="80" height="80" alt="Composer" />
</p>

<h1 align="center">Composer</h1>

<p align="center">
  The lyrics editor for <a href="https://betterlyrics.org">Better Lyrics</a>.<br/>
  Create word-synced TTML lyrics with a visual timeline, tap-to-sync, and live preview.
</p>

<p align="center">
  <a href="https://composer.betterlyrics.org"><img src="https://img.shields.io/badge/Open-composer.betterlyrics.org-F50032?style=flat-square" alt="Open Composer" /></a>
  <a href="https://www.w3.org/TR/2018/REC-ttml1-20181108/"><img src="https://img.shields.io/badge/TTML%201-W3C%20subset-4caf50?style=flat-square" alt="TTML 1 W3C subset" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL%203.0-2196f3?style=flat-square" alt="AGPL 3.0 License" /></a>
  <a href="https://betterlyrics.org"><img src="https://img.shields.io/badge/Built%20for-Better%20Lyrics-F50032?style=flat-square" alt="Built for Better Lyrics" /></a>
</p>

---

## Why Composer

You don't need to know TTML to use Composer. Import a song, paste the lyrics and sync them, by tapping along or by dragging words on the Timeline. Use the step-by-step tabs or the Timeline, whichever suits you. They edit the same project.

The heavy tools are there when a song asks for them. Composer can separate the vocals and align each word to the voice, which leaves you fixing what it missed instead of timing every syllable. A pitch line, a spectrogram, a beat grid and choruses that share timing are all built in.

## How it works

1. **Import** an audio file (MP3, WAV, M4A, OGG, FLAC) or paste a YouTube link
2. **Edit** the lyrics, assign singers, and add background vocals
3. **Sync** by tapping along with the music, or by dragging word blocks on the Timeline
4. **Export** TTML, or keep working later from the projects library

Your work saves automatically in the browser as you go. Audio files you load stay on your machine.

## Features

### Syncing

- Tap-to-sync: press Space in time with the music to stamp each word, or hold to stretch it. Works with touch too.
- Timeline editor: a DAW-style view with draggable word blocks on a waveform, multi-select, and proportional stretch
- Snapping to neighboring words, the playhead, your own markers, and detected vocal onsets
- Syllable splitting, so each part of a word gets its own timing
- Linked groups for repeated sections like choruses. Edit one instance and the others follow, timing included.
- Vocal separation that isolates the vocal stem in the browser, so you can sync against the voice alone

### Lyrics

- Multiple singers, each with their own color, plus background vocals exported with the TTML `x-bg` role
- Translations and romanization, generated automatically or written by hand
- Song details and songwriter credits
- A lyric best practices guide that checks your lyrics against common conventions

### Import and export

- Lyrics import from `.txt`, `.lrc`, `.srt`, `.ttml`, and `.qrc` files, or pasted straight into the Edit tab
- TTML export, with an editable TTML view before you download
- Standalone converters between TTML and LRC, SRT, and QRC
- Project files and backup bundles you can share or restore on another machine

### Everything else

- Projects library with search, recent projects, and storage management
- Live preview rendered with Better Lyrics' own engine
- Themes, with dark and light presets and a custom theme editor
- Keyboard shortcuts for nearly everything, all of them remappable
- Searchable help and settings, plus [written guides](https://composer.betterlyrics.org/guides) on TTML and syncing

## Compared to other editors

Other TTML editors treat ease of use as optional. In [AMLL TTML Tool](https://tool.amll.dev/) you tap F, G and H through the whole song and fix words one at a time on a spectrogram. A singer is either the lead or the duet. Its forks add features on top and keep the same design underneath.

Composer keeps every singer the song has, names included, through import and export. It shows in what people make. One in ten Composer syncs on Unison has three or more singers. In AMLL's own reviewed database, fewer than one in a hundred do.

| | Composer | AMLL TTML Tool |
| --- | --- | --- |
| Timeline | Full editor: select many words, stretch, split, copy and paste, snap to beats and vocal onsets | Move one word at a time on the spectrogram |
| Auto-align to vocals | Yes | No |
| Vocal separation | Yes | No |
| Pitch line | Yes | No |
| Hear audio while scrubbing | Yes, with pitch kept | No |
| Spectrogram | Yes | Yes |
| Sync | Auto-align, drag, or tap | Tap F, G and H |
| Singers | Any number, named, plus groups | Lead or duet |
| Sync non-Latin lyrics by their romanization | Yes, one key switches | No |
| Romanization timed per word | Split from the line automatically | Typed word by word |
| Word-level LRC import | Yes | No |
| YouTube as audio source | Yes | No |

### Good syncs by default

We care about the details most editors skip. Sync snaps to vocal onsets and beats. Auto-align times each word from the separated vocals. Link a repeated chorus and every copy shares one timing, so the second can never drift from the first.

That's why [Unison](https://unison.betterlyrics.org) publishes a sync the moment you submit it. Other lyric databases make every submission wait for a reviewer. We don't. When the Better Lyrics Council finds one it likes, it gets the BLCA seal, our version of an editor's pick. Two thirds of Unison was made in Composer, and Composer syncs are the ones the Council keeps sealing. Start with [Earrings](https://unison.betterlyrics.org/song/BI9HQCzpDgQ), [Touch The Sky](https://unison.betterlyrics.org/song/B95OUKk7alM) or [On My Way](https://unison.betterlyrics.org/song/ZM8rAsTT7yE).

### It stays smooth

The Timeline only redraws while something moves. Separation, pitch tracking, alignment and audio analysis all run in the background. Playback and dragging stay responsive on long songs and slower machines.

### It's easy to learn

The guided tour runs on your own song. Every screen has help, and you can search and remap every shortcut in Settings. You never face a wall of fields you can't use yet.

### It keeps your work

Projects save as you go and every edit can be undone. If the browser still holds something, the recovery page can bring it back. Singers, names, groups and background vocals all survive a round trip through TTML.

## Standards

Composer emits a restricted subset of **TTML 1** ([W3C Recommendation, Nov 2018](https://www.w3.org/TR/2018/REC-ttml1-20181108/)). Word-span times are absolute and timestamps omit the hours field when it is zero, so the output is not strict TTML 1. Linked groups and per-instance metadata use foreign-namespace extensions, which the spec allows and downstream tools can ignore.

For the full breakdown, see **Help → TTML & standards** in the app.

## Services Composer talks to

Composer is a static site, and almost everything runs in the browser. A few optional features need a network service:

| Feature | Service | Without it |
| --- | --- | --- |
| YouTube import | [Composer Bridge](https://github.com/better-lyrics/composer-bridge) running on your own machine, or a [Cobalt](https://github.com/imputnet/cobalt) instance (`VITE_COBALT_API_URL`) | Load audio files instead |
| Translations and romanization | Google Translate, called from the browser | Write them by hand or paste them in |
| Vocal separation | The HTDemucs model, downloaded once from `VITE_VOCAL_MODEL_BASE_URL` | The stem picker is hidden |

## Self-hosting

```bash
pnpm install
pnpm build
```

Serve `dist/` with any static file server, for example `npx serve dist`, nginx, Caddy, or Cloudflare. The hosted version deploys to Cloudflare Workers with `wrangler.jsonc`.

## Development

Requires Node 24 and pnpm 10.

```bash
pnpm install
pnpm dev               # Start dev server with HMR
pnpm test              # Run all tests (unit + browser)
pnpm test:unit         # Unit tests only (jsdom)
pnpm test:component    # Component tests only (Chromium via Playwright)
pnpm lint:fix          # Format and lint
pnpm typecheck         # Type check
```

## Vocal separation hosting

Vocal separation uses HTDemucs (Hybrid Transformer Demucs v4) and runs entirely in the browser through ONNX Runtime Web, on WebGPU when available and WASM otherwise. The model is larger than Cloudflare's 25 MiB static asset limit, so it isn't bundled. It's served from a public Cloudflare R2 bucket instead: R2 egress is free, and a custom domain keeps the file cached at Cloudflare's edge without a Worker in the way.

If `VITE_VOCAL_MODEL_BASE_URL` is unset, the vocal separation picker is hidden.

### Where the model comes from

HTDemucs is the official Facebook AI Research model (`facebookresearch/demucs`, the Hybrid Transformer variant from Nov 2022). The `demucs` Python package downloads the PyTorch weights from `dl.fbaipublicfiles.com` on its own. Two community projects handle the ONNX side:

- [`sevagh/demucs.onnx`](https://github.com/sevagh/demucs.onnx) has the most complete PyTorch to ONNX export. Its fork of `demucs` moves STFT and iSTFT outside the graph so the model exports cleanly. The build script below uses it.
- [`gianlourbano/demucs-onnx`](https://github.com/gianlourbano/demucs-onnx) is an onnxruntime-web reference, useful for checking the STFT and inference shapes on the JS side.

### Build the ONNX models

```bash
# 1. Build fp32 + fp16 ONNX models into ./htdemucs-onnx-out/.
#    Takes 10 to 30 minutes on CPU and needs about 10 GB of free disk.
./scripts/build-htdemucs-onnx.sh

# 2. Upload to your R2 bucket (run `wrangler login` first).
./scripts/upload-htdemucs.sh composer-vocal-models
```

`build-htdemucs-onnx.sh` clones `sevagh/demucs.onnx` into `/tmp/composer-htdemucs-build/`, sets up a Python venv, runs the official converter, then converts the fp32 export to fp16 with `onnxconverter-common`. At the end it prints the model's input and output names and its SHA-256. Check those against `src/audio/separation/worker.ts` and `src/audio/separation/model-registry.ts`.

### One-time R2 setup

1. Create a public R2 bucket (for example `composer-vocal-models`).
2. Bind a custom domain to it (for example `models.composer.betterlyrics.org`). Avoid `r2.dev`: it's rate-limited and meant for development.
3. Add a Cloudflare `Cache Everything` page rule for that hostname so the model is cached at the edge.
4. Add a CORS rule that allows your site's origin.
5. Set `VITE_VOCAL_MODEL_BASE_URL=https://models.composer.betterlyrics.org` at build time.

Cost: free egress, and about $0.0015 a month to store the fp16 model.

### Trying other alignment checkpoints

Auto-align uses HubertFA v0.0.7 by default. To try other checkpoints with the same inputs, outputs and phone set, list them in a manifest named `hubertfa-models.json` next to the models (`$VITE_VOCAL_MODEL_BASE_URL/hubertfa-models.json`). Each one then shows up under Settings > Playback > Alignment model.

```json
{
  "models": [
    {
      "id": "ft-2026-10-25",
      "label": "Posttrain Oct 25",
      "model": "hubertfa_ft_2026-10-25.onnx",
      "sizeMb": 396,
      "languages": ["en"],
      "recommended": true
    }
  ]
}
```

- `model` and the optional `dictionary` (the English pronunciation dictionary, defaulting to the v0.0.7 one) are URLs, relative to the manifest.
- `languages` lists the language codes a checkpoint was trained for. It defaults to the base model's English, Mandarin and Japanese. When the checkpoints cover different languages, the picker gets a tab per language.
- `"recommended": true` tags a checkpoint as the one to use. The setting defaults to **Recommended**, which follows whichever checkpoint has the tag, so moving the tag moves everyone who hasn't picked a model by hand. With no tagged checkpoint, Recommended uses v0.0.7; with several, the first one listed. The id `recommended` is reserved for this, so an entry with it is skipped.
- The picker lists checkpoints in manifest order, after the built-in model, and can sort them by name instead. Numbers in names sort as numbers, so `step 900` comes before `step 5000`.
- The phone vocabulary is bundled with the app (`src/audio/alignment/hubertfa/vocab.json`), so a checkpoint with a different phone set needs a code change, not a manifest entry.
- The browser caches each model by URL, so give every export a new file name. Re-uploading under the same name keeps serving the old copy.
- The manifest is fetched once per page load, without caching. Upload it with `Cache-Control: no-cache` so the edge doesn't keep a stale copy. `./scripts/upload-hubertfa.sh` does this when `hubertfa-models.json` is in its assets folder.
- To test checkpoints on your machine without uploading them, serve a folder holding the manifest and models with CORS enabled (for example `npx serve --cors -l 8787 ./checkpoints`), set `VITE_ALIGNMENT_MODEL_MANIFEST_URL=http://localhost:8787/hubertfa-models.json` in `.env.local`, and restart `pnpm dev`.

## Tech stack

React, TypeScript, Vite, Tailwind CSS v4, Zustand, Motion, Vitest

## Funding

> [!IMPORTANT]
>
> Composer is free for everyone, hosted or self-hosted. If it saves you time or you find it useful, a donation helps keep it going!
>
> Releasing lyrics made with Composer commercially, as a label, distributor or company? See [License](#license) or reach out at composer@boidu.dev.

<a href="https://www.buymeacoffee.com/boidu" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="42" /></a>

[![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23F20C33)](https://github.com/sponsors/boidushya)

## License

Composer is dual-licensed.

The open-source license is [AGPL-3.0](LICENSE). You are free to use, modify, and self-host Composer under its terms.

A commercial license is also available. It removes the AGPL copyleft obligations and covers commercial use of Composer's output, such as a record label or distributor publishing generated lyrics as part of a release. For commercial or enterprise licensing, reach out to composer@boidu.dev.

## Contributors

<a href="https://github.com/better-lyrics/composer/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=better-lyrics/composer" />
</a>
