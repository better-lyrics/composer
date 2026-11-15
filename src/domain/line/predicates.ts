import { bgBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { lineText } from "@/domain/line/text";
import { isSpanTimed, mainTrack, timedSyllables } from "insync/line-track";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Predicates ---------------------------------------------------------------

function isLineSynced(line: LyricLine): boolean {
  return isSpanTimed(mainTrack(line));
}

function isWordSynced(line: LyricLine): boolean {
  return timedSyllables(mainTrack(line)).length > 0;
}

function hasAnyTiming(line: LyricLine): boolean {
  return isWordSynced(line) || isLineSynced(line) || bgBounds(line) !== null;
}

function hasMainLyrics(line: LyricLine): boolean {
  return stripSplitCharacter(lineText(line)).trim().length > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasAnyTiming, hasMainLyrics, isLineSynced, isWordSynced };
