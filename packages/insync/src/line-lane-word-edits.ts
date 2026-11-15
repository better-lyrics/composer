import { withManualBackgroundWords } from "./line-background";
import type { LyricLine } from "./line";
import { withRoleWords } from "./line-track-writes";
import type { WordTiming } from "./word-timing";

// -- Functions ----------------------------------------------------------------

function mainWordsEdit(
  line: LyricLine,
  words: readonly WordTiming[],
  updates: Partial<LyricLine> = {},
): Partial<LyricLine> {
  return { ...updates, tracks: withRoleWords({ ...line, ...updates }, "main", words).tracks };
}

// Any timeline edit of background words is manual curation, so it stamps the track "manual".
function manualBackgroundWordEdit(
  line: LyricLine,
  words: readonly WordTiming[],
  splitChar: string,
  updates: Partial<LyricLine> = {},
): Partial<LyricLine> {
  return { ...updates, tracks: withManualBackgroundWords({ ...line, ...updates }, words, splitChar).tracks };
}

// -- Exports ------------------------------------------------------------------

export { mainWordsEdit, manualBackgroundWordEdit };
