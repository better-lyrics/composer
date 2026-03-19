<p align="center">
  <img src="public/logo.svg" width="80" height="80" alt="Composer" />
</p>

<h1 align="center">Composer</h1>

<p align="center">
  The lyrics editor for <a href="https://better-lyrics.boidu.dev">Better Lyrics</a>.<br/>
  Create word-synced TTML lyrics with a visual timeline, tap-to-sync, and live preview.
</p>

<p align="center">
  <a href="https://composer.boidu.dev">Try it here</a>
</p>

---

## Why Composer

Tools like [AMLL TTML Tool](https://amll-ttml-tool.stevexmh.net/) are powerful and feature-rich. If you know what you're doing, they're great. But if you're new to lyrics syncing, the learning curve is steep. There's no clear starting point, the interface assumes familiarity with TTML structure, and you're expected to already understand concepts like word-level timing and agent roles.

Composer takes a different approach. It's built around a linear mental model: import, edit, sync, export. Each tab is one step. You don't need to know what TTML is to get started. Just paste lyrics, tap along with the music, and you get a synced file.

For users who want more control, the Timeline view is a full GUI where you can do everything without leaving that single screen. Import audio, add lyrics, drag word blocks on the waveform, split syllables, assign agents, preview your work. It's designed so beginners start with the guided tabs and naturally graduate to the Timeline as they get comfortable.

## What it does

Composer turns plain lyrics into precisely timed TTML files. You import audio, paste your lyrics, tap along to sync each word, then export the result. Everything runs in the browser with no server required.

Four-step workflow:

1. **Import** your audio (MP3, WAV, M4A, OGG, FLAC)
2. **Edit** your lyrics, assign agents (singers), add background vocals
3. **Sync** by tapping along with the music, or drag word blocks on the Timeline
4. **Export** as TTML, or save a project file to continue later

## Features

- **Tap-to-sync** - Press Space in time with the music to stamp each word
- **Timeline editor** - DAW-style view with draggable word blocks on a waveform
- **Multiple agents** - Assign lines to different singers with distinct colors
- **Background vocals** - Separate track for backing vocals with `x-bg` TTML role
- **Syllable splitting** - Break words into individually timed syllables
- **Live preview** - See your lyrics rendered in real time with Better Lyrics' engine
- **Lyrics import** - Drop .lrc, .srt, .ttml, or .txt files to get started quickly
- **Project files** - Save and share your work as JSON
- **Keyboard-driven** - Comprehensive shortcuts for every action
- **Client-side only** - No uploads, no accounts, your audio never leaves your machine

## Self-hosting

Composer is a static site with zero backend dependencies. All processing happens in the browser.

```bash
pnpm install
pnpm build
```

Serve the `dist/` folder with any static file server. That's it.

```bash
# Example with any static server
npx serve dist

# Or drop dist/ into nginx, Caddy, Vercel, Netlify, GitHub Pages, etc.
```

## Development

```bash
pnpm install
pnpm dev          # Start dev server with HMR
pnpm test         # Run tests
pnpm lint:fix     # Format and lint
pnpm typecheck    # Type check
```

## Tech stack

React, TypeScript, Vite, TailwindCSS v4, Zustand, Vitest

## License

AGPL-3.0 License. See [LICENSE](LICENSE).
