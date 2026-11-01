import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { PitchPoint } from "@/domain/pitch/track";
import type { Bounds } from "@/domain/word/bounds";

// -- Constants ----------------------------------------------------------------

const MIN_SPILL_SECONDS = 0.08;

// -- Functions ----------------------------------------------------------------

function wordCoverage(spans: readonly Bounds[]): Bounds[] {
  const sorted = spans.filter((span) => span.end > span.begin).toSorted((a, b) => a.begin - b.begin);
  const merged: Bounds[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.begin <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ begin: span.begin, end: span.end });
  }
  return merged;
}

// Every timed word of the song, lead and background, so a spill is singing that no word claims.
interface EditedTrack {
  lineId: string;
  track: "word" | "bg";
  words: readonly Bounds[];
}

// An edited track stands in for that line's stored words, so spills can follow an edit that is not saved yet.
function songWordCoverage(lines: readonly LyricLine[], edited?: EditedTrack): Bounds[] {
  const wordsOf = (line: LyricLine, track: "word" | "bg") =>
    edited && edited.lineId === line.id && edited.track === track
      ? edited.words
      : (effectiveTrackWords(line, track) ?? []);
  return wordCoverage(lines.flatMap((line) => [...wordsOf(line, "word"), ...wordsOf(line, "bg")]));
}

function isCovered(coverage: readonly Bounds[], seconds: number): boolean {
  let low = 0;
  let high = coverage.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const span = coverage[middle];
    if (seconds < span.begin) high = middle - 1;
    else if (seconds >= span.end) low = middle + 1;
    else return true;
  }
  return false;
}

// Singing heard where no word is timed: the stretches the pitch line paints amber.
function spillRuns(runs: readonly PitchPoint[][], coverage: readonly Bounds[]): PitchPoint[][] {
  const spills: PitchPoint[][] = [];
  for (const run of runs) {
    let spill: PitchPoint[] = [];
    const flush = () => {
      if (spill.length > 1 && spill[spill.length - 1].seconds - spill[0].seconds >= MIN_SPILL_SECONDS)
        spills.push(spill);
      spill = [];
    };
    for (const point of run) {
      if (isCovered(coverage, point.seconds)) flush();
      else spill.push(point);
    }
    flush();
  }
  return spills;
}

// -- Exports ------------------------------------------------------------------

export { isCovered, songWordCoverage, spillRuns, wordCoverage };
