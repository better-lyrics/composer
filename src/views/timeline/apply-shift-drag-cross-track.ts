import type { LyricLine, WordTiming } from "@/stores/project";
import { closeIntraGroupGaps } from "@/utils/syllable-groups";
import { addTrailingSpaceIfMissing, resolveOverlapsForward, trimTrailingSpaceFromLast } from "@/utils/word-spaces";

function dissolveGroupAround(words: WordTiming[], groupId: string | undefined): WordTiming[] {
  if (groupId === undefined) return words;
  return words.map((w) => {
    if (w.syllableGroupId !== groupId) return w;
    const { syllableGroupId: _drop, ...rest } = w;
    return rest;
  });
}

function applyShiftDragCrossTrack(
  line: LyricLine,
  fromTrack: "word" | "bg",
  wordIndex: number,
  timeDelta: number,
  duration: number,
): Partial<LyricLine> | null {
  const sourceArray = fromTrack === "word" ? line.words : line.backgroundWords;
  if (!sourceArray || wordIndex < 0 || wordIndex >= sourceArray.length) return null;

  const sourceWord = sourceArray[wordIndex];
  const wordDuration = sourceWord.end - sourceWord.begin;
  const newBegin = Math.max(0, Math.min(duration - wordDuration, sourceWord.begin + timeDelta));
  const newEnd = newBegin + wordDuration;

  const { syllableGroupId: _drop, ...rest } = sourceWord;
  const detachedWord: WordTiming = { ...rest, begin: newBegin, end: newEnd };

  const dissolved = dissolveGroupAround(sourceArray, sourceWord.syllableGroupId);
  const remainingSource = closeIntraGroupGaps(trimTrailingSpaceFromLast(dissolved.filter((_, i) => i !== wordIndex)));

  const destArray = fromTrack === "word" ? line.backgroundWords : line.words;
  const destExisting = destArray ?? [];
  const prevDestLast = destExisting[destExisting.length - 1];
  const sortedDest = [...destExisting, detachedWord].sort((a, b) => a.begin - b.begin);
  const reconciledDest = prevDestLast ? addTrailingSpaceIfMissing(sortedDest, prevDestLast) : sortedDest;
  const mergedDest = closeIntraGroupGaps(trimTrailingSpaceFromLast(resolveOverlapsForward(reconciledDest, duration)));

  if (fromTrack === "word") {
    const mainEmptied = remainingSource.length === 0;
    return {
      words: remainingSource,
      backgroundWords: mergedDest,
      backgroundText: mergedDest.map((w) => w.text).join(""),
      begin: mainEmptied ? undefined : line.begin,
      end: mainEmptied ? undefined : line.end,
    };
  }

  const hasBg = remainingSource.length > 0;
  const hadNoMainBefore = !line.words || line.words.length === 0;
  const mainNowPopulated = mergedDest.length > 0;
  return {
    words: mergedDest,
    backgroundWords: hasBg ? remainingSource : undefined,
    backgroundText: hasBg ? remainingSource.map((w) => w.text).join("") : undefined,
    begin: hadNoMainBefore && mainNowPopulated ? undefined : line.begin,
    end: hadNoMainBefore && mainNowPopulated ? undefined : line.end,
  };
}

export { applyShiftDragCrossTrack };
