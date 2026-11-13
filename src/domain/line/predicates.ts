import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Predicates ---------------------------------------------------------------

function isLineSynced(line: LyricLine): boolean {
  return isSpanTimed(mainTrack(line));
}

function isWordSynced(line: LyricLine): boolean {
  return timedSyllables(mainTrack(line)).length > 0;
}

function hasAnyTiming(line: LyricLine): boolean {
  return isWordSynced(line) || isLineSynced(line) || timedSyllables(backgroundTrack(line)).length > 0;
}

function hasMainLyrics(line: LyricLine): boolean {
  return stripSplitCharacter(lineText(line)).trim().length > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasAnyTiming, hasMainLyrics, isLineSynced, isWordSynced };
