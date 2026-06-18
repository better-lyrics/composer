import type { LyricLine } from "@/domain/line/model";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import { voiceBounds } from "@/domain/voice/bounds";
import { isLineSynced as isLineSyncedVoice, isWordSynced as isWordSyncedVoice } from "@/domain/voice/predicates";

// -- Predicates ---------------------------------------------------------------

function isLineSynced(line: LyricLine): boolean {
  return isLineSyncedVoice(mainVoice(line));
}

function isWordSynced(line: LyricLine): boolean {
  return isWordSyncedVoice(mainVoice(line));
}

function hasAnyTiming(line: LyricLine): boolean {
  if (voiceBounds(mainVoice(line)) !== null) return true;
  const bg = bgVoice(line);
  return bg !== null && voiceBounds(bg) !== null;
}

// -- Exports ------------------------------------------------------------------

export { hasAnyTiming, isLineSynced, isWordSynced };
