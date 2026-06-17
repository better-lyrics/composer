import type { LyricLine } from "@/domain/line/model";
import type { BackgroundSource, BackgroundVoice, Voice } from "@/domain/voice/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function mainVoice(line: LyricLine): Voice {
  if (line.words?.length) return { text: line.text, words: line.words };
  if (line.begin !== undefined && line.end !== undefined) {
    return { text: line.text, begin: line.begin, end: line.end };
  }
  return { text: line.text };
}

function bgVoice(line: LyricLine): BackgroundVoice | null {
  const words = line.backgroundWords?.length ? line.backgroundWords : undefined;
  if (line.backgroundText === undefined && words === undefined) return null;
  const source = line.backgroundTextSource;
  const text = line.backgroundText ?? "";
  if (words) return { text, words, source };
  return { text, source };
}

// The main voice's text. Every voice variant carries text, so this never
// returns undefined. Prefer this over reading the flat field at call sites: it
// reads `line.main.text` once storage is nested, and avoids allocating a Voice
// just to read its text.
function lineText(line: LyricLine): string {
  return line.text;
}

// Raw word-synced word array of the main voice, or undefined when the main
// voice is not word-synced. Mirrors the old `line.words` read exactly. Use this
// for call sites that need the actual word array (filter, map, length), not the
// synthesized single word of `effectiveWords`.
function mainWords(line: LyricLine): WordTiming[] | undefined {
  return line.words;
}

// Raw word-synced word array of the background voice, or undefined. Mirrors the
// old `line.backgroundWords` read exactly.
function bgWords(line: LyricLine): WordTiming[] | undefined {
  return line.backgroundWords;
}

// Raw background text, or undefined when there is no background. Mirrors the old
// `line.backgroundText` read exactly. This is the authored text and is undefined
// for a word-only background, unlike `bgVoice(line)?.text` which normalises to "".
function bgText(line: LyricLine): string | undefined {
  return line.backgroundText;
}

// Background provenance flag, or undefined. Mirrors the old
// `line.backgroundTextSource` read exactly.
function bgSource(line: LyricLine): BackgroundSource | undefined {
  return line.backgroundTextSource;
}

// -- Exports ------------------------------------------------------------------

export { mainVoice, bgVoice, lineText, mainWords, bgWords, bgText, bgSource };
