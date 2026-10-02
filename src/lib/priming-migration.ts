import { parseLamePriming } from "@/audio/lame-priming";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import type { SavedProject } from "@/lib/saved-project";

// -- Helpers ------------------------------------------------------------------

function shiftWord(word: WordTiming, shiftSec: number): WordTiming {
  return {
    ...word,
    begin: Math.max(0, word.begin - shiftSec),
    end: Math.max(0, word.end - shiftSec),
  };
}

function shiftLine(line: LyricLine, shiftSec: number): LyricLine {
  const next = { ...line } as LyricLine;
  if (isWordSynced(next)) {
    (next as { words: WordTiming[] }).words = next.words!.map((w) => shiftWord(w, shiftSec));
  }
  if (isLineSynced(next)) {
    (next as { begin: number; end: number }).begin = Math.max(0, next.begin - shiftSec);
    (next as { begin: number; end: number }).end = Math.max(0, next.end - shiftSec);
  }
  if (next.backgroundWords) {
    next.backgroundWords = next.backgroundWords.map((w) => shiftWord(w, shiftSec));
  }
  return next;
}

// -- Public API ---------------------------------------------------------------

function shiftAllTimings(lines: LyricLine[], shiftSec: number): LyricLine[] {
  if (shiftSec === 0) return lines;
  return lines.map((line) => shiftLine(line, shiftSec));
}

async function stripLamePriming(project: SavedProject, audio: File | undefined): Promise<boolean> {
  if (project.primingStripped === true || !audio) return false;
  const { samples, sampleRate } = parseLamePriming(await audio.arrayBuffer());
  if (samples > 0 && sampleRate > 0) project.lines = shiftAllTimings(project.lines ?? [], samples / sampleRate);
  project.primingStripped = true;
  return true;
}

// -- Exports ------------------------------------------------------------------

export { shiftAllTimings, stripLamePriming };
