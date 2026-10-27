import { parseLamePriming } from "@/audio/lame-priming";
import type { LyricLine } from "@/domain/line/model";
import { shiftWords } from "@/domain/line/shift";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import type { SavedProject } from "@/lib/saved-project";

// -- Helpers ------------------------------------------------------------------

function shiftLine(line: LyricLine, deltaSec: number): LyricLine {
  const next = { ...line } as LyricLine;
  if (isWordSynced(next)) (next as { words: WordTiming[] }).words = shiftWords(next.words!, deltaSec);
  if (isLineSynced(next)) {
    (next as { begin: number; end: number }).begin = Math.max(0, next.begin + deltaSec);
    (next as { begin: number; end: number }).end = Math.max(0, next.end + deltaSec);
  }
  if (next.backgroundWords) next.backgroundWords = shiftWords(next.backgroundWords, deltaSec);
  return next;
}

// -- Public API ---------------------------------------------------------------

function shiftAllTimings(lines: LyricLine[], deltaSec: number): LyricLine[] {
  if (deltaSec === 0) return lines;
  return lines.map((line) => shiftLine(line, deltaSec));
}

async function stripLamePriming(project: SavedProject, audio: File | undefined): Promise<boolean> {
  if (project.primingStripped === true || !audio) return false;
  const { samples, sampleRate } = parseLamePriming(await audio.arrayBuffer());
  if (samples > 0 && sampleRate > 0) project.lines = shiftAllTimings(project.lines ?? [], -(samples / sampleRate));
  project.primingStripped = true;
  return true;
}

// -- Exports ------------------------------------------------------------------

export { shiftAllTimings, stripLamePriming };
