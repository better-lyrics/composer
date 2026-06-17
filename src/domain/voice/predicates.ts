import type { LineSyncedVoice, Voice, WordSyncedVoice } from "@/domain/voice/model";

// -- Functions ----------------------------------------------------------------

function isWordSynced(v: Voice): v is WordSyncedVoice {
  return "words" in v && v.words.length > 0;
}

function isLineSynced(v: Voice): v is LineSyncedVoice {
  return "begin" in v && !isWordSynced(v);
}

function isUntimed(v: Voice): boolean {
  return !isWordSynced(v) && !isLineSynced(v);
}

// -- Exports ------------------------------------------------------------------

export { isUntimed, isLineSynced, isWordSynced };
