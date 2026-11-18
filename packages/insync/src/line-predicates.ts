import { bgBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { lineText } from "./line-text";
import { isSpanTimed, mainTrack, timedSyllables } from "./line-track";
import { withoutSplitCharacter } from "./split-character-text";

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

function hasMainLyrics(line: LyricLine, splitChar: string): boolean {
  return withoutSplitCharacter(lineText(line, splitChar), splitChar).trim().length > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasAnyTiming, hasMainLyrics, isLineSynced, isWordSynced };
