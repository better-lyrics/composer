import type { LyricLine } from "@/domain/line/model";
import type { BackgroundVoice, Voice } from "@/domain/voice/model";

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

// -- Exports ------------------------------------------------------------------

export { mainVoice, bgVoice, lineText };
