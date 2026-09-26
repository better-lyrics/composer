import type { LineSyncedLine, LyricLine } from "@/domain/line/model";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Predicates ---------------------------------------------------------------

function isLineSynced(line: LyricLine): line is LineSyncedLine {
  return !line.words?.length && line.begin !== undefined && line.end !== undefined;
}

function isWordSynced(line: LyricLine): boolean {
  return !!line.words?.length;
}

function hasAnyTiming(line: LyricLine): boolean {
  return isWordSynced(line) || isLineSynced(line) || !!line.backgroundWords?.length;
}

function hasMainLyrics(line: LyricLine): boolean {
  return stripSplitCharacter(line.text).trim().length > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasAnyTiming, hasMainLyrics, isLineSynced, isWordSynced };
