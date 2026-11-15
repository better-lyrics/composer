import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "insync/line";
import { type SyncGapTrack, timedWordSlotRanges } from "@/domain/line/sync-progress";
import { backgroundText, lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";

// -- Types ---------------------------------------------------------------------

interface ZeroLengthWordIssue {
  lineId: string;
  lineIndex: number;
  track: SyncGapTrack;
  kind: "zero-length";
  count: number;
  problemSlots: readonly number[];
}

// -- Functions -----------------------------------------------------------------

// TTML writes whole milliseconds, so compare at that precision.
function hasNoLengthInFile(timed: WordTiming): boolean {
  return Math.round(timed.end * 1000) <= Math.round(timed.begin * 1000);
}

function trackIssue(
  line: LyricLine,
  lineIndex: number,
  track: SyncGapTrack,
  text: string,
  words: readonly WordTiming[],
): ZeroLengthWordIssue | null {
  const zeroLength = words.flatMap((timed, wordIndex) => (hasNoLengthInFile(timed) ? [wordIndex] : []));
  if (zeroLength.length === 0) return null;
  const ranges = timedWordSlotRanges(text, words);
  const problemSlots = zeroLength.flatMap((wordIndex) => {
    const range = ranges[wordIndex];
    return range ? Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset) : [];
  });
  return { lineId: line.id, lineIndex, track, kind: "zero-length", count: zeroLength.length, problemSlots };
}

function zeroLengthWordIssues(lines: readonly LyricLine[]): ZeroLengthWordIssue[] {
  return lines.flatMap((line, lineIndex) =>
    [
      trackIssue(line, lineIndex, "main", lineText(line), timedSyllables(mainTrack(line))),
      trackIssue(line, lineIndex, "background", backgroundText(line) ?? "", drawnSyllables(line, "bg")),
    ].filter((issue) => issue !== null),
  );
}

// -- Exports -------------------------------------------------------------------

export type { ZeroLengthWordIssue };
export { zeroLengthWordIssues };
