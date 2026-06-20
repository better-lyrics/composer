import type { LyricLine } from "@/domain/line/model";
import type { BackgroundSource, BackgroundVoice, Voice } from "@/domain/voice/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function mainVoice(line: LyricLine): Voice {
  return line.main;
}

function bgVoice(line: LyricLine): BackgroundVoice | null {
  return line.background ?? null;
}

// The main voice's text. Every voice variant carries text, so this never
// returns undefined. Reads `line.main.text` directly.
function lineText(line: LyricLine): string {
  return line.main.text;
}

// Raw word-synced word array of the main voice, or undefined when the main
// voice is not word-synced. Use this for call sites that need the actual word
// array (filter, map, length), not the synthesized single word that
// `effectiveVoiceWords` / `getEffectiveLines` produce for line-synced voices.
function mainWords(line: LyricLine): WordTiming[] | undefined {
  return "words" in line.main ? line.main.words : undefined;
}

// Raw word-synced word array of the background voice, or undefined when there
// is no word-synced background.
function bgWords(line: LyricLine): WordTiming[] | undefined {
  return line.background && "words" in line.background ? line.background.words : undefined;
}

// Background text, or undefined when there is no background. reconcileLine
// stores "" for a word-only background with no authored text.
function bgText(line: LyricLine): string | undefined {
  return line.background?.text;
}

// Background provenance flag, or undefined.
function bgSource(line: LyricLine): BackgroundSource | undefined {
  return line.background?.source;
}

// -- Exports ------------------------------------------------------------------

export { mainVoice, bgVoice, lineText, mainWords, bgWords, bgText, bgSource };
