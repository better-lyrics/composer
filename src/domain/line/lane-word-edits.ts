import { withManualBackgroundWords } from "@/domain/line/background";
import { type ReadableLine, rawLineOf } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { withRoleWords } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function mainWordsEdit(
  line: ReadableLine,
  words: readonly WordTiming[],
  updates: Partial<LyricLine> = {},
): Partial<LyricLine> {
  return { ...updates, tracks: withRoleWords({ ...rawLineOf(line), ...updates }, "main", words).tracks };
}

// Any timeline edit of background words is manual curation, so it stamps the track "manual".
function manualBackgroundWordEdit(
  line: ReadableLine,
  words: readonly WordTiming[],
  updates: Partial<LyricLine> = {},
): Partial<LyricLine> {
  return { ...updates, tracks: withManualBackgroundWords({ ...rawLineOf(line), ...updates }, words).tracks };
}

// -- Exports ------------------------------------------------------------------

export { mainWordsEdit, manualBackgroundWordEdit };
