import type { LyricLine } from "@/domain/line/model";
import { type SyncGapTrack, timedWordSlotRanges } from "@/domain/line/sync-progress";
import type { WordTiming } from "@/domain/word/timing";

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

function trackIssue(
  line: LyricLine,
  lineIndex: number,
  track: SyncGapTrack,
  text: string,
  words: readonly WordTiming[],
): ZeroLengthWordIssue | null {
  const zeroLength = words.flatMap((timed, wordIndex) => (timed.end <= timed.begin ? [wordIndex] : []));
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
      trackIssue(line, lineIndex, "main", line.text, line.words ?? []),
      trackIssue(line, lineIndex, "background", line.backgroundText ?? "", line.backgroundWords ?? []),
    ].filter((issue) => issue !== null),
  );
}

// -- Exports -------------------------------------------------------------------

export type { ZeroLengthWordIssue };
export { zeroLengthWordIssues };
